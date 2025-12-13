#!/usr/bin/env python3
"""
Robust Post-Processor for Activepieces Flow JSON

A generalized solution that:
1. Uses piece registry to fix trigger/action names
2. Handles field name conversions for all pieces
3. Fixes versions automatically from registry
4. Is extensible for new pieces

Based on analysis of training data (767 entries) and actual piece source code.
"""

import json
import re
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path


class NameMatcher:
    """
    Robust pattern matching for trigger/action names.
    
    Uses multiple strategies:
    1. Exact match
    2. Normalized match (lowercase, no separators)
    3. Token overlap (split by separators, compare tokens)
    4. Edit distance (Levenshtein)
    5. Prefix stripping (remove piece name prefixes like "gmail_", "googlesheets_")
    6. Suffix matching (partial match at end)
    7. Semantic synonyms (add=insert, get=fetch, etc.)
    """
    
    # Common piece prefixes to strip
    PIECE_PREFIXES = [
        "gmail_", "gmail-", "gmail",
        "googlesheets_", "googlesheets-", "googlesheets", "google_sheets_", "google-sheets-", "google-sheets",
        "slack_", "slack-", "slack",
        "hubspot_", "hubspot-", "hubspot",
        "webhook_", "webhook-", "webhook",
        "schedule_", "schedule-", "schedule",
        "telegram_", "telegram-", "telegram",
        "notion_", "notion-", "notion",
        "openai_", "openai-", "openai",
        "forms_", "forms-", "forms",
        "http_", "http-", "http",
        "drive_", "drive-", "drive", "google_drive_", "google-drive-",
        "sheets_", "sheets-", "sheets",
        "pipedrive_", "pipedrive-", "pipedrive",
        "salesforce_", "salesforce-", "salesforce",
    ]
    
    # Semantic synonyms: words that mean the same thing in API contexts
    SYNONYMS = {
        # Verbs
        "add": ["insert", "create", "new", "append"],
        "insert": ["add", "create", "new", "append"],
        "create": ["add", "insert", "new", "make"],
        "get": ["fetch", "retrieve", "read", "find", "lookup", "list"],
        "fetch": ["get", "retrieve", "read", "find", "list"],
        "retrieve": ["get", "fetch", "find", "read", "list"],  # Added explicit retrieve
        "find": ["get", "search", "lookup", "query", "fetch", "retrieve", "list"],
        "search": ["find", "query", "lookup", "get", "list"],
        "list": ["get", "fetch", "find", "retrieve"],
        "update": ["edit", "modify", "change", "patch"],
        "edit": ["update", "modify", "change"],
        "delete": ["remove", "trash", "destroy"],
        "remove": ["delete", "trash", "destroy"],
        "send": ["post", "submit", "dispatch", "transmit", "publish"],
        "post": ["send", "submit", "create", "publish"],
        "submit": ["send", "post", "create"],
        "receive": ["get", "catch", "incoming", "handle"],
        "catch": ["receive", "capture", "intercept", "handle", "incoming"],
        "incoming": ["catch", "receive", "new", "handle"],  # Added incoming
        "handle": ["catch", "receive", "process"],
        "trigger": ["webhook", "event", "hook"],
        "webhook": ["trigger", "hook", "request", "callback", "incoming"],
        "request": ["webhook", "call", "invoke"],
        
        # Nouns
        "message": ["msg", "notification", "alert", "text"],
        "email": ["mail", "message"],
        "row": ["record", "entry", "line", "item", "rows"],
        "rows": ["row", "records", "entries", "items", "list"],
        "channel": ["room", "chat", "public"],  # channel is default/public
        "direct": ["dm", "private", "personal"],
        "response": ["reply", "answer"],
        "new": ["created", "added", "incoming", "fresh"],
    }
    
    # Default preferences when two options have similar scores
    # Map: token -> preferred token when ambiguous
    DEFAULT_PREFERENCES = {
        # Prefer "channel" over "direct" when sending generic messages
        ("send", "message"): "channel",
        ("post", "message"): "channel",
        ("submit", "message"): "channel",
    }
    
    @staticmethod
    def levenshtein_distance(s1: str, s2: str) -> int:
        """Calculate Levenshtein (edit) distance between two strings."""
        if len(s1) < len(s2):
            return NameMatcher.levenshtein_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    @staticmethod
    def normalize(name: str) -> str:
        """Normalize a name: lowercase, remove all separators."""
        return name.lower().replace("_", "").replace("-", "").replace(" ", "")
    
    @staticmethod
    def tokenize(name: str) -> List[str]:
        """
        Split name into tokens.
        Handles: snake_case, kebab-case, camelCase, PascalCase
        """
        # First, convert camelCase/PascalCase to snake_case
        # Insert _ before uppercase letters that follow lowercase
        name = re.sub(r'([a-z])([A-Z])', r'\1_\2', name)
        # Split by _ or -
        tokens = re.split(r'[_\-\s]+', name.lower())
        # Remove empty tokens
        return [t for t in tokens if t]
    
    @staticmethod
    def strip_piece_prefix(name: str) -> str:
        """Remove common piece prefixes from a name."""
        lower_name = name.lower()
        for prefix in NameMatcher.PIECE_PREFIXES:
            if lower_name.startswith(prefix):
                return name[len(prefix):]
        return name
    
    @staticmethod
    def expand_with_synonyms(tokens: List[str]) -> set:
        """Expand a token list with synonyms."""
        expanded = set(tokens)
        for token in tokens:
            if token in NameMatcher.SYNONYMS:
                expanded.update(NameMatcher.SYNONYMS[token])
        return expanded
    
    @staticmethod
    def tokens_match_with_synonyms(token1: str, token2: str) -> bool:
        """Check if two tokens match (exact or via synonyms)."""
        if token1 == token2:
            return True
        if token1 in NameMatcher.SYNONYMS:
            if token2 in NameMatcher.SYNONYMS[token1]:
                return True
        if token2 in NameMatcher.SYNONYMS:
            if token1 in NameMatcher.SYNONYMS[token2]:
                return True
        return False
    
    @staticmethod
    def token_overlap_score(tokens1: List[str], tokens2: List[str]) -> float:
        """
        Calculate token overlap score (Jaccard-like) with synonym support.
        Returns a score between 0 and 1.
        """
        if not tokens1 or not tokens2:
            return 0.0
        
        # Expand both token sets with synonyms
        expanded1 = NameMatcher.expand_with_synonyms(tokens1)
        expanded2 = NameMatcher.expand_with_synonyms(tokens2)
        
        # Calculate intersection and union
        intersection = len(expanded1 & expanded2)
        union = len(expanded1 | expanded2)
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    @staticmethod
    def token_sequence_score(tokens1: List[str], tokens2: List[str]) -> float:
        """
        Calculate how many tokens match in sequence (with synonym support).
        Handles cases like ["new", "email"] matching ["gmail", "new", "email", "received"]
        """
        if not tokens1 or not tokens2:
            return 0.0
        
        # Find longest common subsequence (with synonyms)
        max_matches = 0
        for i in range(len(tokens2)):
            matches = 0
            for j, t1 in enumerate(tokens1):
                if i + j < len(tokens2):
                    if NameMatcher.tokens_match_with_synonyms(tokens2[i + j], t1):
                        matches += 1
                    else:
                        break
                else:
                    break
            max_matches = max(max_matches, matches)
        
        # Also try matching tokens1 anywhere in tokens2 (non-contiguous)
        non_contiguous_matches = 0
        for t1 in tokens1:
            for t2 in tokens2:
                if NameMatcher.tokens_match_with_synonyms(t1, t2):
                    non_contiguous_matches += 1
                    break
        
        # Return the better score
        contiguous_score = max_matches / max(len(tokens1), len(tokens2))
        non_contiguous_score = non_contiguous_matches / max(len(tokens1), len(tokens2))
        
        return max(contiguous_score, non_contiguous_score * 0.9)  # Slight penalty for non-contiguous
    
    @staticmethod
    def similarity_score(name1: str, name2: str) -> float:
        """
        Calculate overall similarity score between two names.
        Returns a score between 0 and 1.
        """
        # Exact match
        if name1 == name2:
            return 1.0
        
        # Normalized exact match
        norm1 = NameMatcher.normalize(name1)
        norm2 = NameMatcher.normalize(name2)
        if norm1 == norm2:
            return 0.98
        
        # Strip prefixes and compare
        stripped1 = NameMatcher.normalize(NameMatcher.strip_piece_prefix(name1))
        stripped2 = NameMatcher.normalize(NameMatcher.strip_piece_prefix(name2))
        if stripped1 == stripped2:
            return 0.95
        
        # One is substring of other (after normalization)
        if norm1 in norm2 or norm2 in norm1:
            return 0.90
        
        # Stripped substring match
        if stripped1 in stripped2 or stripped2 in stripped1:
            return 0.85
        
        # Token-based matching
        tokens1 = NameMatcher.tokenize(name1)
        tokens2 = NameMatcher.tokenize(name2)
        
        # Check for semantic synonym match in key tokens
        # If the "action verb" (usually first or second token) matches via synonym, boost score
        verb_match_bonus = 0.0
        if tokens1 and tokens2:
            # Compare first non-prefix tokens
            key_tokens1 = [t for t in tokens1 if t not in ['new', 'on', 'the', 'a', 'an', 'to', 'from']][:2]
            key_tokens2 = [t for t in tokens2 if t not in ['new', 'on', 'the', 'a', 'an', 'to', 'from']][:2]
            for kt1 in key_tokens1:
                for kt2 in key_tokens2:
                    if NameMatcher.tokens_match_with_synonyms(kt1, kt2):
                        verb_match_bonus = 0.25
                        break
        
        # Token overlap (with synonyms)
        overlap_score = NameMatcher.token_overlap_score(tokens1, tokens2)
        
        # Token sequence (with synonyms)
        sequence_score = NameMatcher.token_sequence_score(tokens1, tokens2)
        
        # Edit distance on stripped versions (more forgiving)
        max_len = max(len(stripped1), len(stripped2))
        if max_len > 0:
            edit_distance = NameMatcher.levenshtein_distance(stripped1, stripped2)
            edit_score = 1 - (edit_distance / max_len)
        else:
            edit_score = 0
        
        # Combine scores (weighted average)
        combined_score = (
            overlap_score * 0.25 +
            sequence_score * 0.35 +
            edit_score * 0.25 +
            verb_match_bonus * 0.15
        )
        
        # Apply verb match bonus as an addition, capped at 1.0
        final_score = min(1.0, combined_score + verb_match_bonus * 0.1)
        
        return final_score
    
    @staticmethod
    def find_best_match(target: str, candidates: List[str], threshold: float = 0.45) -> Optional[Tuple[str, float]]:
        """
        Find the best matching candidate for a target name.
        
        Args:
            target: The name to match
            candidates: List of valid names to match against
            threshold: Minimum similarity score to consider a match
            
        Returns:
            Tuple of (best_match, score) or None if no match above threshold
        """
        if not candidates:
            return None
        
        # Exact match first
        if target in candidates:
            return (target, 1.0)
        
        # Score all candidates
        scored = []
        for candidate in candidates:
            score = NameMatcher.similarity_score(target, candidate)
            scored.append((candidate, score))
        
        # Sort by score descending
        scored.sort(key=lambda x: x[1], reverse=True)
        
        if not scored or scored[0][1] < threshold:
            return None
        
        # If top two scores are very close (within 5%), apply preference rules
        if len(scored) >= 2 and scored[0][1] - scored[1][1] < 0.05:
            target_tokens = set(NameMatcher.tokenize(target))
            
            # Check preferences
            for (key_tokens, preferred) in NameMatcher.DEFAULT_PREFERENCES.items():
                # If target contains the key tokens
                if all(t in target_tokens or any(NameMatcher.tokens_match_with_synonyms(t, tt) for tt in target_tokens) for t in key_tokens):
                    # Find candidate with preferred token
                    for candidate, score in scored[:2]:
                        if preferred in candidate.lower():
                            return (candidate, score)
        
        return (scored[0][0], scored[0][1])


class PieceRegistry:
    """Registry of piece metadata from source code."""
    
    # Default versions from package.json (scanned from source)
    VERSIONS = {
        "@activepieces/piece-google-sheets": "~0.12.20",
        "@activepieces/piece-text-ai": "~0.4.8",
        "@activepieces/piece-gmail": "~0.9.6",
        "@activepieces/piece-slack": "~0.10.16",
        "@activepieces/piece-schedule": "~0.1.13",
        "@activepieces/piece-utility-ai": "~0.5.9",
        "@activepieces/piece-google-drive": "~0.5.52",
        "@activepieces/piece-hubspot": "~0.7.19",
        "@activepieces/piece-date-helper": "~0.1.19",
        "@activepieces/piece-forms": "~0.4.10",
        "@activepieces/piece-webhook": "~0.1.25",
        "@activepieces/piece-telegram-bot": "~0.3.21",
        "@activepieces/piece-store": "~0.6.10",
        "@activepieces/piece-http": "~0.9.5",
        "@activepieces/piece-notion": "~0.4.13",
        "@activepieces/piece-tables": "~0.2.8",
        "@activepieces/piece-openai": "~0.6.7",
        "@activepieces/piece-salesforce": "~0.2.1",
        "@activepieces/piece-pipedrive": "~0.7.7",
        "@activepieces/piece-data-mapper": "~0.3.11",
        "@activepieces/piece-google-forms": "~0.3.13",
        "@activepieces/piece-ai": "~0.0.2",
    }
    
    # Trigger name mappings: wrong_name -> correct_name
    # Based on training data analysis and source code scan
    TRIGGER_FIXES = {
        # Google Sheets
        "@activepieces/piece-google-sheets": {
            "new_row": "googlesheets_new_row_added",
            "newRow": "googlesheets_new_row_added",
            "new-row": "googlesheets_new_row_added",
            "new_or_updated_row": "google-sheets-new-or-updated-row",
        },
        # Gmail
        "@activepieces/piece-gmail": {
            "new_email": "gmail_new_email_received",
            "newEmail": "gmail_new_email_received",
            "new-email": "gmail_new_email_received",
            "new_email_received": "gmail_new_email_received",  # Common model variation
            "newEmailReceived": "gmail_new_email_received",
            "new-email-received": "gmail_new_email_received",
        },
        # Slack
        "@activepieces/piece-slack": {
            "new_message": "new-message-in-channel",
            "newMessage": "new-message-in-channel",
            "new-message": "new-message-in-channel",
            "new_message_typical": "new-message-in-channel",
            "newMessageTypical": "new-message-in-channel",
            "new_message_threaded": "new-message-in-channel",
            "newMessageThreaded": "new-message-in-channel",
            "new_message_in_channel": "new-message-in-channel",
            "newMessageInChannel": "new-message-in-channel",
            "new_command": "new_command",
            "newCommand": "new_command",
            "new_mention": "new_mention",
            "newMention": "new_mention",
            "new_reaction": "new_reaction_added",
            "newReaction": "new_reaction_added",
            "new_reaction_added": "new_reaction_added",
            "newReactionAdded": "new_reaction_added",
        },
        # Schedule (most common - 126 uses in training data)
        "@activepieces/piece-schedule": {
            # These are already correct in most cases
        },
        # Forms
        "@activepieces/piece-forms": {
            "new_form_submission": "form_submission",
            "newSubmission": "form_submission",
        },
        # Webhook
        "@activepieces/piece-webhook": {
            "catch_request": "catch_webhook",
            "webhook": "catch_webhook",
        },
        # GitHub
        "@activepieces/piece-github": {
            "github_new_issue": "trigger_issues",
            "new_issue": "trigger_issues",
            "githubNewIssue": "trigger_issues",
            "github_new_pull_request": "trigger_pull_request",
            "new_pull_request": "trigger_pull_request",
            "githubNewPullRequest": "trigger_pull_request",
            "github_push": "trigger_push",
            "push": "trigger_push",
            "github_star": "trigger_star",
            "star": "trigger_star",
        },
        # HubSpot
        "@activepieces/piece-hubspot": {
            "new_contact": "new-contact",
            "newContact": "new-contact",
        },
        # Google Drive
        "@activepieces/piece-google-drive": {
            "new_file": "new_file",
            "newFile": "new_file",
            "new-file": "new_file",
            "new_folder": "new_folder",
            "newFolder": "new_folder",
        },
        # Google Calendar
        "@activepieces/piece-google-calendar": {
            "google_calendar_new_event": "new_event",
            "googleCalendarNewEvent": "new_event",
            "new-event": "new_event",
            "newEvent": "new_event",
            "calendar_event": "new_event",
            "new_or_updated_event": "new_or_updated_event",
            "event_starts": "event_starts_in",
            "event_starts_in": "event_starts_in",
            "eventStartsIn": "event_starts_in",
        },
    }
    
    # Action name mappings: wrong_name -> correct_name
    ACTION_FIXES = {
        # Google Sheets
        "@activepieces/piece-google-sheets": {
            "insertRow": "insert_row",
            "insert-row": "insert_row",
            "updateRow": "update_row",
            "update-row": "update_row",
            "findRows": "find_rows",
            "find-rows": "find_rows",
            "deleteRow": "delete_row",
            "delete-row": "delete_row",
            "getManyRows": "get-many-rows",
            "get_many_rows": "get-many-rows",
        },
        # Gmail
        "@activepieces/piece-gmail": {
            "sendEmail": "send_email",
            "send-email": "send_email",
            "compose_and_send_email": "send_email",
            "composeAndSendEmail": "send_email",
            "compose_email": "send_email",
            "composeEmail": "send_email",
            "get_mail": "gmail_get_mail",
            "getMail": "gmail_get_mail",
            "get_email": "gmail_get_mail",
            "getEmail": "gmail_get_mail",
            "search_mail": "gmail_search_mail",
            "searchMail": "gmail_search_mail",
            "search_email": "gmail_search_mail",
            "searchEmail": "gmail_search_mail",
            "find_email": "gmail_search_mail",
            "findEmail": "gmail_search_mail",
            "get_thread": "gmail_get_thread",
            "getThread": "gmail_get_thread",
        },
        # Slack
        "@activepieces/piece-slack": {
            "sendMessage": "send_channel_message",
            "send_message": "send_channel_message",
            "sendChannelMessage": "send_channel_message",
            "post_message": "send_channel_message",
            "postMessage": "send_channel_message",
            "send_dm": "send_direct_message",
            "sendDm": "send_direct_message",
            "send_direct": "send_direct_message",
            "sendDirect": "send_direct_message",
            "sendDirectMessage": "send_direct_message",
            "update_message": "update-message",
            "updateMessage": "update-message",
            "get_channel_history": "getChannelHistory",
            "getChannelHistory": "getChannelHistory",
            "get_thread": "retrieveThreadMessages",
            "getThread": "retrieveThreadMessages",
            "retrieve_thread": "retrieveThreadMessages",
            "retrieveThread": "retrieveThreadMessages",
        },
        # Google Drive
        "@activepieces/piece-google-drive": {
            "store_file": "upload_gdrive_file",
            "storeFile": "upload_gdrive_file",
            "upload_file": "upload_gdrive_file",
            "uploadFile": "upload_gdrive_file",
            "upload-file": "upload_gdrive_file",
            "save_file": "upload_gdrive_file",
            "saveFile": "upload_gdrive_file",
            "create_file": "upload_gdrive_file",
            "createFile": "upload_gdrive_file",
            "create_folder": "create_folder",
            "createFolder": "create_folder",
            "create-folder": "create_folder",
            "delete_file": "trash_gdrive_file",
            "deleteFile": "trash_gdrive_file",
            "trash_file": "trash_gdrive_file",
            "trashFile": "trash_gdrive_file",
            "get_file": "get-file-or-folder-by-id",
            "getFile": "get-file-or-folder-by-id",
            "read_file": "read-file",
            "readFile": "read-file",
            "list_files": "list-files",
            "listFiles": "list-files",
            "search_file": "search-folder",
            "searchFile": "search-folder",
            "find_file": "search-folder",
            "findFile": "search-folder",
        },
        # Google Calendar
        "@activepieces/piece-google-calendar": {
            "create_event": "create_google_calendar_event",
            "createEvent": "create_google_calendar_event",
            "create-event": "create_google_calendar_event",
            "add_event": "create_google_calendar_event",
            "addEvent": "create_google_calendar_event",
            "get_event": "google_calendar_get_event_by_id",
            "getEvent": "google_calendar_get_event_by_id",
            "find_event": "google_calendar_get_event_by_id",
            "findEvent": "google_calendar_get_event_by_id",
            "quick_event": "create_quick_event",
            "quickEvent": "create_quick_event",
        },
        # Store
        "@activepieces/piece-store": {
            "get_value": "get",
            "getValue": "get",
            "get_next_row": "get",
            "getNextRow": "get",
            "put_value": "put",
            "putValue": "put",
            "set_value": "put",
            "setValue": "put",
            "store_value": "put",
            "storeValue": "put",
            "save_value": "put",
            "saveValue": "put",
            "add_to_list": "add_to_list",
            "addToList": "add_to_list",
            "append_to_list": "add_to_list",
            "appendToList": "add_to_list",
            "remove_value": "remove_value",
            "removeValue": "remove_value",
            "delete_value": "remove_value",
            "deleteValue": "remove_value",
        },
        # Text AI
        "@activepieces/piece-text-ai": {
            "ask_ai": "askAi",
            "ask-ai": "askAi",
            "summarize_text": "summarizeText",
            "summarize-text": "summarizeText",
        },
        # OpenAI
        "@activepieces/piece-openai": {
            "askChatGpt": "ask_chatgpt",
            "ask-chatgpt": "ask_chatgpt",
            "ask_chatgpt": "ask_chatgpt",
            "textToSpeech": "text_to_speech",
            "visionPrompt": "vision_prompt",
        },
        # HTTP
        "@activepieces/piece-http": {
            "sendRequest": "send_request",
            "send-request": "send_request",
        },
        # Data Mapper
        "@activepieces/piece-data-mapper": {
            "advancedMapping": "advanced_mapping",
            "advanced-mapping": "advanced_mapping",
        },
        # Store
        "@activepieces/piece-store": {
            "getValue": "get",
            "get_value": "get",
            "putValue": "put",
            "put_value": "put",
        },
    }
    
    # Field name conversions by piece
    # Based on actual prop names from source code
    FIELD_CONVERSIONS = {
        "@activepieces/piece-google-sheets": {
            # snake_case -> camelCase (Google Sheets uses camelCase)
            "spreadsheet_id": "spreadsheetId",
            "sheet_id": "sheetId",
            "row_id": "rowId",
            "first_row_headers": "firstRowHeaders",
            "include_team_drives": "includeTeamDrives",
            "column_name": "columnName",
        },
        "@activepieces/piece-slack": {
            # Slack uses camelCase already - mostly correct
        },
        "@activepieces/piece-gmail": {
            # Gmail uses snake_case
            "bodyType": "body_type",
            "replyTo": "reply_to",
        },
        "@activepieces/piece-schedule": {
            # Schedule uses snake_case
            "hourOfTheDay": "hour_of_the_day",
            "runOnWeekends": "run_on_weekends",
            "dayOfTheWeek": "day_of_the_week",
        },
        "@activepieces/piece-google-forms": {
            # Google Forms uses snake_case
            "formId": "form_id",
            "includeTeamDrives": "include_team_drives",
        },
        "@activepieces/piece-hubspot": {
            # HubSpot uses camelCase
        },
        "@activepieces/piece-openai": {
            # OpenAI uses camelCase
            "max_tokens": "maxTokens",
            "frequency_penalty": "frequencyPenalty",
        },
    }


class RobustFlowPostProcessor:
    """
    Robust post-processor for Activepieces flow JSON.
    
    Features:
    - Automatic version fixing from registry
    - Trigger/action name normalization
    - Field name conversion by piece type
    - Schema version handling
    - UI field cleanup
    """
    
    def __init__(self, target_schema_version: str = "10"):
        self.target_schema_version = target_schema_version
        self.registry = PieceRegistry()
    
    def process(self, flow_json: Dict[str, Any]) -> Dict[str, Any]:
        """Process a flow JSON object and fix all issues."""
        # Make a deep copy
        flow = json.loads(json.dumps(flow_json))
        
        # Check if this is a FlowTemplate format
        if "template" in flow and "trigger" in flow.get("template", {}):
            # Process the template's flow
            template_flow = flow["template"]
            template_flow = self._process_flow(template_flow)
            flow["template"] = template_flow
            return flow
        else:
            # Process as raw flow
            return self._process_flow(flow)
    
    def _process_flow(self, flow: Dict[str, Any]) -> Dict[str, Any]:
        """Process a raw flow object."""
        # 1. Fix root level
        flow = self._fix_root_level(flow)
        
        # 2. Fix trigger
        if "trigger" in flow:
            flow["trigger"] = self._fix_trigger(flow["trigger"])
        
        # 3. Fix actions recursively
        if "trigger" in flow and "nextAction" in flow["trigger"]:
            flow["trigger"]["nextAction"] = self._fix_action(flow["trigger"]["nextAction"])
        
        return flow
    
    def _fix_root_level(self, flow: Dict[str, Any]) -> Dict[str, Any]:
        """Fix root level issues."""
        # Fix name -> displayName
        if "name" in flow and "displayName" not in flow:
            flow["displayName"] = flow["name"]
        
        # Ensure displayName exists
        if "displayName" not in flow:
            flow["displayName"] = "Untitled Flow"
        
        # Fix schemaVersion
        if "schemaVersion" not in flow or flow["schemaVersion"] is None:
            flow["schemaVersion"] = self.target_schema_version
        
        return flow
    
    def _fix_trigger(self, trigger: Dict[str, Any]) -> Dict[str, Any]:
        """Fix trigger issues."""
        # Ensure required fields
        if "type" not in trigger:
            trigger["type"] = "PIECE_TRIGGER"
        if "valid" not in trigger:
            trigger["valid"] = True
        if "name" not in trigger:
            trigger["name"] = "trigger"
        if "displayName" not in trigger:
            trigger["displayName"] = "Trigger"
        
        # Fix settings
        if "settings" in trigger:
            trigger["settings"] = self._fix_settings(trigger["settings"], is_trigger=True)
        
        return trigger
    
    def _fix_action(self, action: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Recursively fix action issues."""
        if action is None:
            return None
        
        # Fix action type: CONDITION -> ROUTER
        action_type = action.get("type", "")
        if action_type == "CONDITION":
            action["type"] = "ROUTER"
            self._ensure_router_structure(action)
        
        # Ensure required fields
        if "type" not in action:
            action["type"] = "PIECE"
        if "valid" not in action:
            action["valid"] = True
        if "displayName" not in action:
            action["displayName"] = action.get("name", "Action")
        
        # Fix settings
        if "settings" in action and action.get("type") == "PIECE":
            action["settings"] = self._fix_settings(action["settings"], is_trigger=False)
        
        # Clean up UI-only fields
        self._remove_ui_fields(action)
        
        # Fix nextAction recursively
        if "nextAction" in action:
            action["nextAction"] = self._fix_action(action["nextAction"])
        
        # Fix children (for ROUTER)
        if "children" in action:
            action["children"] = [
                self._fix_action(child) for child in action.get("children", [])
            ]
        
        # Fix firstLoopAction (for LOOP_ON_ITEMS)
        if "firstLoopAction" in action:
            action["firstLoopAction"] = self._fix_action(action["firstLoopAction"])
        
        return action
    
    def _fix_settings(self, settings: Dict[str, Any], is_trigger: bool = False) -> Dict[str, Any]:
        """Fix settings object."""
        piece_name = settings.get("pieceName", "")
        
        # 1. Fix version from registry
        if piece_name in self.registry.VERSIONS:
            settings["pieceVersion"] = self.registry.VERSIONS[piece_name]
        elif "pieceVersion" not in settings or not settings["pieceVersion"]:
            # Default to a generic version
            settings["pieceVersion"] = "~1.0.0"
        
        # 2. Fix trigger/action name
        if is_trigger and "triggerName" in settings:
            settings["triggerName"] = self._fix_trigger_name(piece_name, settings["triggerName"])
        elif not is_trigger and "actionName" in settings:
            settings["actionName"] = self._fix_action_name(piece_name, settings["actionName"])
        
        # 3. Ensure input exists
        if "input" not in settings:
            settings["input"] = {}
        
        # 4. Fix field names
        settings["input"] = self._fix_field_names(piece_name, settings["input"])
        
        # 5. Ensure propertySettings exists
        if "propertySettings" not in settings:
            settings["propertySettings"] = {}
        
        # 6. Update propertySettings for all input fields
        for field_name in settings["input"].keys():
            if field_name not in settings["propertySettings"]:
                settings["propertySettings"][field_name] = {"type": "MANUAL"}
        
        # 7. Remove UI-only fields
        for field in ["sampleData", "inputUiInfo", "pieceType", "packageType", "sampleDataUiInfo"]:
            if field in settings:
                del settings[field]
        
        return settings
    
    def _fix_trigger_name(self, piece_name: str, trigger_name: str) -> str:
        """
        Fix trigger name using multiple strategies:
        1. Hardcoded fixes (fastest)
        2. Piece registry lookup with robust pattern matching
        """
        # First, try hardcoded fixes (common variations)
        if piece_name in self.registry.TRIGGER_FIXES:
            fixes = self.registry.TRIGGER_FIXES[piece_name]
            if trigger_name in fixes:
                return fixes[trigger_name]
        
        # Then, try piece registry with robust matching
        try:
            registry_path = Path(__file__).parent / "piece_registry.json"
            if registry_path.exists():
                with open(registry_path, 'r', encoding='utf-8') as f:
                    registry = json.load(f)
                
                if piece_name in registry:
                    piece_data = registry[piece_name]
                    available_triggers = [t["name"] for t in piece_data.get("triggers", [])]
                    
                    # Use robust pattern matching
                    match = NameMatcher.find_best_match(
                        trigger_name, 
                        available_triggers, 
                        threshold=0.5  # Accept matches with 50%+ similarity
                    )
                    
                    if match:
                        best_match, score = match
                        # Log for debugging (can be removed later)
                        if trigger_name != best_match:
                            print(f"  ℹ️  Fixed trigger: '{trigger_name}' → '{best_match}' (score: {score:.2f})")
                        return best_match
        except Exception as e:
            pass  # Fall back to original if registry lookup fails
        
        return trigger_name
    
    def _fix_action_name(self, piece_name: str, action_name: str) -> str:
        """
        Fix action name using multiple strategies:
        1. Hardcoded fixes (fastest)
        2. Piece registry lookup with robust pattern matching
        """
        # First, try hardcoded fixes (common variations)
        if piece_name in self.registry.ACTION_FIXES:
            fixes = self.registry.ACTION_FIXES[piece_name]
            if action_name in fixes:
                return fixes[action_name]
        
        # Then, try piece registry with robust matching
        try:
            registry_path = Path(__file__).parent / "piece_registry.json"
            if registry_path.exists():
                with open(registry_path, 'r', encoding='utf-8') as f:
                    registry = json.load(f)
                
                if piece_name in registry:
                    piece_data = registry[piece_name]
                    available_actions = [a["name"] for a in piece_data.get("actions", [])]
                    
                    # Use robust pattern matching
                    match = NameMatcher.find_best_match(
                        action_name, 
                        available_actions, 
                        threshold=0.5  # Accept matches with 50%+ similarity
                    )
                    
                    if match:
                        best_match, score = match
                        # Log for debugging (can be removed later)
                        if action_name != best_match:
                            print(f"  ℹ️  Fixed action: '{action_name}' → '{best_match}' (score: {score:.2f})")
                        return best_match
        except Exception as e:
            pass  # Fall back to original if registry lookup fails
        
        return action_name
    
    def _fix_field_names(self, piece_name: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix field names using registry."""
        if piece_name not in self.registry.FIELD_CONVERSIONS:
            return input_data
        
        conversions = self.registry.FIELD_CONVERSIONS[piece_name]
        fixed = {}
        
        for key, value in input_data.items():
            if key in conversions:
                fixed[conversions[key]] = value
            else:
                fixed[key] = value
        
        return fixed
    
    def _ensure_router_structure(self, action: Dict[str, Any]):
        """Ensure ROUTER action has proper structure."""
        if "settings" not in action:
            action["settings"] = {}
        
        if "branches" not in action["settings"]:
            # Try to create branches from conditions
            conditions = action["settings"].get("conditions", [])
            if conditions:
                action["settings"]["branches"] = [
                    {
                        "branchType": "CONDITION",
                        "branchName": "Branch 1",
                        "conditions": conditions
                    },
                    {
                        "branchType": "FALLBACK",
                        "branchName": "Otherwise"
                    }
                ]
            else:
                action["settings"]["branches"] = [
                    {"branchType": "FALLBACK", "branchName": "Otherwise"}
                ]
        
        if "executionType" not in action["settings"]:
            action["settings"]["executionType"] = "EXECUTE_FIRST_MATCH"
    
    def _remove_ui_fields(self, obj: Dict[str, Any]):
        """Remove UI-only fields from an object."""
        ui_fields = ["sampleData", "inputUiInfo", "sampleDataUiInfo", "pieceType", "packageType"]
        for field in ui_fields:
            if field in obj:
                del obj[field]
    
    def process_string(self, json_str: str) -> Dict[str, Any]:
        """Process a JSON string."""
        # Clean the string
        json_str = json_str.strip()
        
        # Try to extract JSON if it's wrapped in markdown or other text
        if "```json" in json_str:
            match = re.search(r'```json\s*(.*?)\s*```', json_str, re.DOTALL)
            if match:
                json_str = match.group(1).strip()
        elif "```" in json_str:
            match = re.search(r'```\s*(.*?)\s*```', json_str, re.DOTALL)
            if match:
                json_str = match.group(1).strip()
        
        # Try to find JSON object boundaries
        if json_str.startswith("{") and not json_str.endswith("}"):
            # Try to find the last closing brace
            brace_count = 0
            last_brace = -1
            for i, char in enumerate(json_str):
                if char == "{":
                    brace_count += 1
                elif char == "}":
                    brace_count -= 1
                    if brace_count == 0:
                        last_brace = i
                        break
            if last_brace > 0:
                json_str = json_str[:last_brace + 1]
        
        # Try to fix common JSON syntax errors
        fixed_str = self._fix_json_syntax(json_str)
        
        # Parse JSON
        try:
            flow = json.loads(fixed_str)
        except json.JSONDecodeError as e:
            # Try to extract just the JSON part
            try:
                # Find the first { and try to parse from there
                start_idx = fixed_str.find("{")
                if start_idx >= 0:
                    flow = json.loads(fixed_str[start_idx:])
                else:
                    raise ValueError(f"Invalid JSON: {e}")
            except:
                raise ValueError(f"Invalid JSON: {e}")
        
        return self.process(flow)
    
    def _fix_json_syntax(self, json_str: str) -> str:
        """Fix common JSON syntax errors."""
        # Fix double colon
        fixed = re.sub(r'":\s*"([^"]+)":\s*"([^"]+)"', r'": "\1\2"', json_str)
        return fixed
    
    # Note: FlowTemplate conversion moved to flow_template_converter.py
    # Use that module to convert processed flows to UI-importable format
    
    def validate(self, flow: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate a processed flow."""
        errors = []
        
        # Check if it's FlowTemplate format
        if "template" in flow:
            # Validate the template
            template = flow["template"]
            return self._validate_raw_flow(template)
        else:
            return self._validate_raw_flow(flow)
    
    def _validate_raw_flow(self, flow: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate a raw flow (not FlowTemplate)."""
        errors = []
        
        # Check root level
        if "displayName" not in flow:
            errors.append("Missing 'displayName' at root level")
        
        if "schemaVersion" not in flow:
            errors.append("Missing 'schemaVersion'")
        
        # Check trigger
        if "trigger" not in flow:
            errors.append("Missing 'trigger'")
        else:
            trigger = flow["trigger"]
            for field in ["name", "type", "valid", "displayName", "settings"]:
                if field not in trigger:
                    errors.append(f"Trigger missing '{field}'")
            
            if "settings" in trigger:
                settings = trigger["settings"]
                if trigger.get("type") == "PIECE_TRIGGER":
                    for field in ["pieceName", "pieceVersion", "triggerName"]:
                        if field not in settings:
                            errors.append(f"Trigger settings missing '{field}'")
        
        return len(errors) == 0, errors


def post_process_flow(flow_input, schema_version: str = "10") -> Dict[str, Any]:
    """
    Convenience function to post-process a flow.
    
    Args:
        flow_input: Either a JSON string or a dict
        schema_version: Target schema version
    
    Returns:
        Processed flow dict
    """
    processor = RobustFlowPostProcessor(target_schema_version=schema_version)
    
    if isinstance(flow_input, str):
        return processor.process_string(flow_input)
    else:
        return processor.process(flow_input)


# FlowTemplate conversion moved to flow_template_converter.py
# Use: from flow_template_converter import convert_to_flow_template


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python robust_post_processor.py <input_file> [output_file]")
        print("")
        print("Robust post-processing for AI-generated Activepieces flows.")
        print("Fixes versions, trigger/action names, field names, and schema issues.")
        print("")
        print("After processing, use flow_template_converter.py to convert to UI format:")
        print("  python flow_template_converter.py processed.json template.json")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Read input
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Process
    try:
        processor = RobustFlowPostProcessor()
        result = processor.process_string(content)
        
        # Validate
        is_valid, errors = processor.validate(result)
        
        if is_valid:
            print("✅ Flow is valid!")
        else:
            print("⚠️  Flow has validation errors:")
            for error in errors:
                print(f"   - {error}")
        
        # Output
        output_json = json.dumps(result, indent=2, ensure_ascii=False)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(output_json)
            print(f"\n✅ Processed flow saved to: {output_file}")
            print(f"   Next: python flow_template_converter.py {output_file} template.json")
        else:
            print("\n" + "="*60)
            print("PROCESSED FLOW:")
            print("="*60)
            print(output_json)
    
    except Exception as e:
        print(f"❌ Error processing flow: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

