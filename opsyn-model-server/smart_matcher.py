#!/usr/bin/env python3
"""
Smart Matcher for Activepieces Trigger/Action Names

Uses multiple techniques to match model-generated names to valid codebase names:
1. Exact match (fastest)
2. Normalized match (handles format variations)
3. Fuzzy match (handles typos and close variations)
4. Token-based match (handles semantic similarity)

This eliminates the need for ever-growing static mappings.
"""

import re
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
from functools import lru_cache

# Try to import rapidfuzz, fall back to basic matching if not available
try:
    from rapidfuzz import fuzz, process
    FUZZY_AVAILABLE = True
except ImportError:
    FUZZY_AVAILABLE = False
    print("[SmartMatcher] Warning: rapidfuzz not installed. Using basic matching.")


# =============================================================================
# NAME NORMALIZATION
# =============================================================================

def normalize_to_snake_case(name: str) -> str:
    """Convert any naming convention to snake_case."""
    if not name:
        return name
    
    # Handle camelCase and PascalCase
    # Insert underscore before uppercase letters
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    s2 = re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1)
    
    # Replace hyphens with underscores
    s3 = s2.replace('-', '_')
    
    # Lowercase and remove double underscores
    s4 = re.sub('_+', '_', s3.lower())
    
    # Remove leading/trailing underscores
    return s4.strip('_')


def remove_piece_prefix(name: str, piece_name: str) -> str:
    """Remove piece-specific prefixes from action/trigger names."""
    if not name or not piece_name:
        return name
    
    # Extract piece short name (e.g., "gmail" from "@activepieces/piece-gmail")
    piece_short = piece_name.replace("@activepieces/piece-", "").replace("-", "_")
    
    normalized = normalize_to_snake_case(name)
    
    # Common prefix patterns to remove
    prefixes_to_try = [
        f"{piece_short}_",           # gmail_send_email -> send_email
        f"{piece_short.replace('_', '')}_",  # googlesheets_new_row -> new_row
    ]
    
    for prefix in prefixes_to_try:
        if normalized.startswith(prefix):
            return normalized[len(prefix):]
    
    return normalized


def extract_tokens(name: str) -> Set[str]:
    """Extract meaningful tokens from a name."""
    normalized = normalize_to_snake_case(name)
    tokens = set(normalized.split('_'))
    # Remove very short tokens and common words
    stopwords = {'a', 'an', 'the', 'to', 'on', 'in', 'for', 'by', 'new', 'get', 'is'}
    return {t for t in tokens if len(t) > 1 and t not in stopwords}


# =============================================================================
# MATCHING ALGORITHMS
# =============================================================================

def exact_match(input_name: str, valid_names: List[str]) -> Optional[str]:
    """Try exact match first."""
    if input_name in valid_names:
        return input_name
    return None


def normalized_match(input_name: str, valid_names: List[str]) -> Optional[str]:
    """Match after normalizing both sides to snake_case."""
    input_normalized = normalize_to_snake_case(input_name)
    
    for valid in valid_names:
        if normalize_to_snake_case(valid) == input_normalized:
            return valid
    
    return None


def fuzzy_match(input_name: str, valid_names: List[str], threshold: int = 75) -> Optional[Tuple[str, int]]:
    """Use fuzzy string matching to find closest match."""
    if not FUZZY_AVAILABLE or not valid_names:
        return None
    
    # Normalize input for better matching
    input_normalized = normalize_to_snake_case(input_name)
    
    # Create normalized versions of valid names for matching
    valid_normalized = [normalize_to_snake_case(v) for v in valid_names]
    
    # Find best match
    result = process.extractOne(
        input_normalized, 
        valid_normalized,
        scorer=fuzz.ratio
    )
    
    if result and result[1] >= threshold:
        # Return the original (non-normalized) valid name
        idx = valid_normalized.index(result[0])
        return (valid_names[idx], result[1])
    
    return None


def token_match(input_name: str, valid_names: List[str], threshold: float = 0.5) -> Optional[Tuple[str, float]]:
    """Match based on token overlap (Jaccard similarity)."""
    input_tokens = extract_tokens(input_name)
    
    if not input_tokens:
        return None
    
    best_match = None
    best_score = 0.0
    
    for valid in valid_names:
        valid_tokens = extract_tokens(valid)
        if not valid_tokens:
            continue
        
        # Jaccard similarity
        intersection = len(input_tokens & valid_tokens)
        union = len(input_tokens | valid_tokens)
        score = intersection / union if union > 0 else 0
        
        if score > best_score and score >= threshold:
            best_score = score
            best_match = valid
    
    if best_match:
        return (best_match, best_score)
    
    return None


def prefix_stripped_match(
    input_name: str, 
    valid_names: List[str], 
    piece_name: str
) -> Optional[str]:
    """Match after removing piece-specific prefixes."""
    input_stripped = remove_piece_prefix(input_name, piece_name)
    
    for valid in valid_names:
        valid_stripped = remove_piece_prefix(valid, piece_name)
        if input_stripped == valid_stripped:
            return valid
    
    return None


# =============================================================================
# MAIN SMART MATCHER
# =============================================================================

class SmartMatcher:
    """
    Intelligent matcher for trigger/action names.
    
    Uses a cascade of matching techniques:
    1. Exact match
    2. Normalized match (snake_case)
    3. Prefix-stripped match
    4. Fuzzy match (if rapidfuzz available)
    5. Token-based match
    """
    
    def __init__(self, piece_registry_path: Optional[Path] = None):
        self.valid_triggers: Dict[str, List[str]] = {}  # piece_name -> [trigger_names]
        self.valid_actions: Dict[str, List[str]] = {}   # piece_name -> [action_names]
        self._load_from_training_data()
    
    def _load_from_training_data(self):
        """
        Load known valid trigger/action names from training data analysis.
        This gives us a baseline of what's definitely valid.
        """
        # These are verified from piece_analysis_report.json
        self.valid_triggers = {
            "@activepieces/piece-slack": [
                "new-message", "new-message-in-channel", "new_reaction_added", 
                "new_command", "new-user", "channel_created", "new-direct-message", "new_mention"
            ],
            "@activepieces/piece-gmail": ["gmail_new_email_received", "new_labeled_email"],
            "@activepieces/piece-google-sheets": [
                "googlesheets_new_row_added", "google-sheets-new-or-updated-row", "new-worksheet"
            ],
            "@activepieces/piece-webhook": ["catch_webhook"],
            "@activepieces/piece-notion": ["new_database_item", "updated_database_item"],
            "@activepieces/piece-schedule": [
                "every_day", "every_hour", "every_week", "every_month", 
                "every_x_minutes", "cron_expression"
            ],
            "@activepieces/piece-airtable": ["new_record", "updated_record"],
            "@activepieces/piece-hubspot": ["new-contact", "new-blog-article"],
            "@activepieces/piece-trello": ["new_card", "card_moved_to_list"],
            "@activepieces/piece-github": [
                "issues", "pull_request", "star", "push", "new_branch", 
                "new_release", "new_milestone", "new_collaborator", "new_label"
            ],
            "@activepieces/piece-google-drive": ["new_file", "new_folder"],
            "@activepieces/piece-jira-cloud": ["new_issue", "updated_issue_status"],
            "@activepieces/piece-discord": ["new_message", "new_member"],
            "@activepieces/piece-telegram-bot": ["new_telegram_message"],
            "@activepieces/piece-typeform": ["new_submission"],
            "@activepieces/piece-calendly": ["invitee_created", "invitee_canceled"],
            "@activepieces/piece-stripe": [
                "new_payment", "payment_failed", "new_subscription", 
                "new_customer", "new_payment_link", "invoice_payment_failed"
            ],
            "@activepieces/piece-shopify": [
                "new_order", "new_paid_order", "new_cancelled_order", 
                "new_abandoned_checkout", "new_customer", "updated_product"
            ],
            "@activepieces/piece-twilio": ["new_recording", "incoming_call", "incoming_message"],
            "@activepieces/piece-google-forms": ["new_response"],
            "@activepieces/piece-google-calendar": ["event_starts_in", "new_or_updated_event"],
            "@activepieces/piece-mailchimp": ["subscribe", "unsubscribe"],
            "@activepieces/piece-woocommerce": [
                "order_created", "order_updated", "order_deleted",
                "product_created", "product_updated", "product_deleted",
                "customer_created", "customer_updated", "customer_deleted",
                "coupon_created", "coupon_updated", "coupon_deleted"
            ],
            "@activepieces/piece-postgres": ["new-row"],
            "@activepieces/piece-amazon-s3": ["new_file"],
            "@activepieces/piece-webflow": ["new_submission", "new_form_submission"],
            "@activepieces/piece-todoist": ["task_completed"],
            "@activepieces/piece-intercom": ["lead-converted-to-user", "replyFromUser"],
            "@activepieces/piece-surveymonkey": ["new_response"],
            "@activepieces/piece-microsoft-outlook": ["newEmail"],
            "@activepieces/piece-facebook-leads": ["new_lead"],
            "@activepieces/piece-clickup": ["task_tag_updated", "task_created", "task_updated"],
            "@activepieces/piece-pipedrive": ["new_deal", "new_person", "new_activity"],
            "@activepieces/piece-google-docs": ["new-document"],
            "@activepieces/piece-zendesk": ["new_ticket", "updated_ticket"],
            "@activepieces/piece-salesforce": ["new_lead", "new_opportunity", "new_contact"],
            "@activepieces/piece-quickbooks": ["new_invoice", "new_customer", "new_payment"],
        }
        
        self.valid_actions = {
            "@activepieces/piece-slack": [
                "send_channel_message", "send_direct_message", "invite-user-to-channel",
                "request_approval_message", "slack-add-reaction-to-message", "slack-create-channel",
                "slack-find-user-by-email", "find-user-by-id", "updateMessage", "uploadFile",
                "get-message", "listUsers", "searchMessages", "set-channel-topic"
            ],
            "@activepieces/piece-gmail": [
                "send_email", "gmail_get_mail", "gmail_get_thread", "gmail_search_mail",
                "reply_email", "create_draft", "get_labels"
            ],
            "@activepieces/piece-google-sheets": [
                "insert_row", "update_row", "delete_row", "find_rows", "find_row_by_num",
                "get_next_rows", "export_sheet", "google-sheets-insert-multiple-rows",
                "clear_sheet", "create_worksheet", "delete_worksheet"
            ],
            "@activepieces/piece-webhook": ["return_response"],
            "@activepieces/piece-notion": [
                "create_database_item", "update_database_item", "append_to_page",
                "add_comment", "archive_database_item", "getPageOrBlockChildren",
                "createPage", "find_page", "notion-find-database-item"
            ],
            "@activepieces/piece-http": ["send_request"],
            "@activepieces/piece-airtable": [
                "airtable_create_record", "airtable_update_record", "airtable_delete_record",
                "airtable_find_record", "airtable_get_record_by_id"
            ],
            "@activepieces/piece-hubspot": [
                "create-contact", "create-or-update-contact", "find-contact",
                "update-contact", "get-owner-by-id", "create-deal", "update-company"
            ],
            "@activepieces/piece-trello": [
                "create_card", "update_card", "get_card", "delete_card",
                "add_card_attachment", "create_board", "create_list"
            ],
            "@activepieces/piece-github": [
                "github_create_issue", "createCommentOnAIssue", "getIssueInformation",
                "add_labels_to_issue", "update_issue", "create_pull_request"
            ],
            "@activepieces/piece-google-drive": [
                "upload_gdrive_file", "create_new_gdrive_file", "create_new_gdrive_folder",
                "duplicate_file", "read-file", "list-files", "get-file-or-folder-by-id",
                "google-drive-move-file", "delete-file"
            ],
            "@activepieces/piece-jira-cloud": [
                "create_issue", "add_issue_comment", "update_issue", "get_issue",
                "assign_issue", "transition_issue"
            ],
            "@activepieces/piece-discord": [
                "sendMessageWithBot", "send_message_webhook", "create_channel",
                "add_role", "remove_role"
            ],
            "@activepieces/piece-telegram-bot": [
                "send_text_message", "send_media", "get_chat_member",
                "send_location", "send_document"
            ],
            "@activepieces/piece-openai": [
                "ask_chatgpt", "ask_assistant", "vision_prompt", "generate_image",
                "text_to_speech", "transcribe_audio"
            ],
            "@activepieces/piece-stripe": [
                "create_customer", "retrieve_customer", "create_subscription",
                "create_payment_intent", "create_invoice", "search_subscriptions",
                "create_payment_link", "deactivate_payment_link"
            ],
            "@activepieces/piece-mailchimp": [
                "add_member_to_list", "add_note_to_subscriber", "add_tag_to_subscriber",
                "update_subscriber_status", "create_campaign"
            ],
            "@activepieces/piece-asana": ["create_task", "update_task", "complete_task", "get_task"],
            "@activepieces/piece-todoist": ["create_task", "complete_task", "update_task"],
            "@activepieces/piece-linear": ["linear_create_issue", "linear_update_issue"],
            "@activepieces/piece-clickup": ["create_task", "update_task", "get_task"],
            "@activepieces/piece-twilio": ["send_sms", "make_call"],
            "@activepieces/piece-sendgrid": ["send_email", "send_dynamic_template"],
            "@activepieces/piece-shopify": [
                "get_customer_orders", "create_product", "update_product",
                "create_order", "update_order", "get_product"
            ],
            "@activepieces/piece-amazon-s3": [
                "upload-file", "read-file", "list-files", "deleteFile",
                "moveFile", "generate-signed-url"
            ],
            "@activepieces/piece-dropbox": [
                "upload_dropbox_file", "get_dropbox_file_link", "move_dropbox_folder",
                "create_folder", "delete_file"
            ],
            "@activepieces/piece-google-calendar": [
                "create_google_calendar_event", "google_calendar_get_event_by_id",
                "update_event", "delete_event"
            ],
            "@activepieces/piece-google-docs": [
                "create_document", "append_text", "create_document_based_on_template"
            ],
            "@activepieces/piece-postgres": ["run-query", "insert_row", "select_rows"],
            "@activepieces/piece-zendesk": [
                "create-ticket", "find-tickets", "update-ticket", "add_comment"
            ],
            "@activepieces/piece-salesforce": [
                "create_lead", "update_record", "create_contact", "create_opportunity"
            ],
            "@activepieces/piece-quickbooks": [
                "create_invoice", "find_invoice", "find_payment", "create_customer"
            ],
            "@activepieces/piece-pipedrive": [
                "create-deal", "create-person", "find-deals-associated-with-person",
                "update-deal", "create-activity"
            ],
            "@activepieces/piece-intercom": [
                "add-or-remove-tag-on-conversation", "addNoteToConversation",
                "create-conversation", "reply-to-conversation"
            ],
            "@activepieces/piece-monday": ["monday_create_item", "update_item"],
            "@activepieces/piece-clockify": ["create-time-entry", "stop-timer"],
            "@activepieces/piece-sftp": ["listFolderContents", "read_file_content", "upload_file"],
            "@activepieces/piece-text-ai": ["askAi", "summarize", "translate"],
            "@activepieces/piece-google-gemini": ["chat_gemini", "generate_content"],
            "@activepieces/piece-woocommerce": [
                "create_product", "update_product", "create_order", "update_order",
                "get_order", "get_product"
            ],
        }
    
    def find_best_trigger(
        self, 
        input_name: str, 
        piece_name: str,
        confidence_threshold: int = 70
    ) -> Tuple[str, str, float]:
        """
        Find the best matching trigger name.
        
        Returns: (matched_name, match_type, confidence)
        - match_type: 'exact', 'normalized', 'prefix', 'fuzzy', 'token', 'none'
        - confidence: 0-100 for fuzzy, 1.0 for exact/normalized, 0.0-1.0 for token
        """
        valid_names = self.valid_triggers.get(piece_name, [])
        
        if not valid_names:
            return (input_name, 'no_registry', 0)
        
        # 1. Exact match
        result = exact_match(input_name, valid_names)
        if result:
            return (result, 'exact', 100)
        
        # 2. Normalized match
        result = normalized_match(input_name, valid_names)
        if result:
            return (result, 'normalized', 95)
        
        # 3. Prefix-stripped match
        result = prefix_stripped_match(input_name, valid_names, piece_name)
        if result:
            return (result, 'prefix', 90)
        
        # 4. Fuzzy match
        if FUZZY_AVAILABLE:
            result = fuzzy_match(input_name, valid_names, confidence_threshold)
            if result:
                return (result[0], 'fuzzy', result[1])
        
        # 5. Token-based match
        result = token_match(input_name, valid_names, 0.5)
        if result:
            return (result[0], 'token', int(result[1] * 100))
        
        return (input_name, 'none', 0)
    
    def find_best_action(
        self, 
        input_name: str, 
        piece_name: str,
        confidence_threshold: int = 70
    ) -> Tuple[str, str, float]:
        """
        Find the best matching action name.
        
        Returns: (matched_name, match_type, confidence)
        """
        valid_names = self.valid_actions.get(piece_name, [])
        
        if not valid_names:
            return (input_name, 'no_registry', 0)
        
        # 1. Exact match
        result = exact_match(input_name, valid_names)
        if result:
            return (result, 'exact', 100)
        
        # 2. Normalized match
        result = normalized_match(input_name, valid_names)
        if result:
            return (result, 'normalized', 95)
        
        # 3. Prefix-stripped match
        result = prefix_stripped_match(input_name, valid_names, piece_name)
        if result:
            return (result, 'prefix', 90)
        
        # 4. Fuzzy match
        if FUZZY_AVAILABLE:
            result = fuzzy_match(input_name, valid_names, confidence_threshold)
            if result:
                return (result[0], 'fuzzy', result[1])
        
        # 5. Token-based match
        result = token_match(input_name, valid_names, 0.5)
        if result:
            return (result[0], 'token', int(result[1] * 100))
        
        return (input_name, 'none', 0)


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_matcher_instance: Optional[SmartMatcher] = None

def get_smart_matcher() -> SmartMatcher:
    """Get or create singleton SmartMatcher instance."""
    global _matcher_instance
    if _matcher_instance is None:
        _matcher_instance = SmartMatcher()
    return _matcher_instance


def smart_match_trigger(input_name: str, piece_name: str, min_confidence: int = 85) -> str:
    """
    Conservative trigger name matching - only changes value if:
    1. Input is NOT already a valid trigger name
    2. A match is found with HIGH confidence (85%+ by default)
    
    This ensures we never break already-correct values.
    """
    matcher = get_smart_matcher()
    valid_names = matcher.valid_triggers.get(piece_name, [])
    
    # SAFETY: If input is already valid, don't touch it!
    if input_name in valid_names:
        return input_name
    
    # Also check normalized version
    input_normalized = normalize_to_snake_case(input_name)
    for valid in valid_names:
        if normalize_to_snake_case(valid) == input_normalized:
            return valid  # Return the canonical form
    
    # Only now try fuzzy matching with HIGH threshold
    result, match_type, confidence = matcher.find_best_trigger(input_name, piece_name)
    
    # Only apply fuzzy/token matches if confidence is very high
    if match_type in ('fuzzy', 'token') and confidence < min_confidence:
        print(f"[SmartMatcher] Trigger '{input_name}' - low confidence match '{result}' ({confidence}%), keeping original")
        return input_name  # Keep original if not confident enough
    
    if match_type not in ('exact', 'none', 'no_registry') and result != input_name:
        print(f"[SmartMatcher] Trigger '{input_name}' → '{result}' ({match_type}, {confidence}%)")
    
    return result


def smart_match_action(input_name: str, piece_name: str, min_confidence: int = 85) -> str:
    """
    Conservative action name matching - only changes value if:
    1. Input is NOT already a valid action name
    2. A match is found with HIGH confidence (85%+ by default)
    
    This ensures we never break already-correct values.
    """
    matcher = get_smart_matcher()
    valid_names = matcher.valid_actions.get(piece_name, [])
    
    # SAFETY: If input is already valid, don't touch it!
    if input_name in valid_names:
        return input_name
    
    # Also check normalized version
    input_normalized = normalize_to_snake_case(input_name)
    for valid in valid_names:
        if normalize_to_snake_case(valid) == input_normalized:
            return valid  # Return the canonical form
    
    # Only now try fuzzy matching with HIGH threshold
    result, match_type, confidence = matcher.find_best_action(input_name, piece_name)
    
    # Only apply fuzzy/token matches if confidence is very high
    if match_type in ('fuzzy', 'token') and confidence < min_confidence:
        print(f"[SmartMatcher] Action '{input_name}' - low confidence match '{result}' ({confidence}%), keeping original")
        return input_name  # Keep original if not confident enough
    
    if match_type not in ('exact', 'none', 'no_registry') and result != input_name:
        print(f"[SmartMatcher] Action '{input_name}' → '{result}' ({match_type}, {confidence}%)")
    
    return result


# =============================================================================
# TEST
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("Testing SmartMatcher - Conservative Mode")
    print("=" * 60)
    print("\nKey behavior:")
    print("  ✓ Already-valid values are NEVER changed")
    print("  ✓ Fuzzy matches only applied if confidence >= 85%")
    print("  ✓ Unknown values stay unchanged (safe fallback)")
    print()
    
    # Test the convenience functions (conservative behavior)
    print("-" * 60)
    print("TEST 1: Already-valid values should NOT change")
    print("-" * 60)
    
    # These are already valid - should return unchanged
    valid_cases = [
        ("trigger", "new_message", "@activepieces/piece-discord"),
        ("trigger", "new_payment", "@activepieces/piece-stripe"),
        ("action", "send_channel_message", "@activepieces/piece-slack"),
        ("action", "insert_row", "@activepieces/piece-google-sheets"),
    ]
    
    for test_type, input_name, piece in valid_cases:
        if test_type == "trigger":
            result = smart_match_trigger(input_name, piece)
        else:
            result = smart_match_action(input_name, piece)
        
        status = "✅" if result == input_name else "❌ CHANGED (BAD!)"
        print(f"{status} {test_type}: '{input_name}' → '{result}'")
    
    print()
    print("-" * 60)
    print("TEST 2: Invalid values should be fixed (high confidence)")
    print("-" * 60)
    
    # These need fixing - should find the right match
    invalid_cases = [
        ("trigger", "new_message_created", "@activepieces/piece-discord", "new_message"),
        ("trigger", "newMessage", "@activepieces/piece-slack", "new-message"),
        ("action", "sendChannelMessage", "@activepieces/piece-slack", "send_channel_message"),
    ]
    
    for test_type, input_name, piece, expected in invalid_cases:
        if test_type == "trigger":
            result = smart_match_trigger(input_name, piece)
        else:
            result = smart_match_action(input_name, piece)
        
        if result == expected:
            status = "✅"
        elif result == input_name:
            status = "⚠️  (kept original - not confident enough)"
        else:
            status = f"❓ (got '{result}', expected '{expected}')"
        print(f"{status} {test_type}: '{input_name}' → '{result}'")
    
    print()
    print("-" * 60)
    print("TEST 3: Unknown values should stay unchanged (safe)")
    print("-" * 60)
    
    # These are garbage - should NOT change
    unknown_cases = [
        ("trigger", "xyz_random_trigger", "@activepieces/piece-slack"),
        ("action", "do_something_weird", "@activepieces/piece-gmail"),
    ]
    
    for test_type, input_name, piece in unknown_cases:
        if test_type == "trigger":
            result = smart_match_trigger(input_name, piece)
        else:
            result = smart_match_action(input_name, piece)
        
        status = "✅" if result == input_name else "❌ CHANGED (BAD!)"
        print(f"{status} {test_type}: '{input_name}' → '{result}' (should stay unchanged)")
    
    print()
    print("=" * 60)
    print("Test complete!")
    print("=" * 60)
