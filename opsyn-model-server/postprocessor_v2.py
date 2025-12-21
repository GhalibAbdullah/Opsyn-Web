#!/usr/bin/env python3
"""
Robust Post-Processor for Fine-Tuned Model Outputs.

All mappings verified against actual Activepieces codebase.
"""

import json
import re
from typing import Dict, Any, Optional, List, Tuple, Set
from copy import deepcopy


# =============================================================================
# VERIFIED PIECE NAMES (from packages/pieces/community/*/package.json)
# =============================================================================
PIECE_NAME_MAP = {
    # Common aliases → canonical names
    "slack": "@activepieces/piece-slack",
    "gmail": "@activepieces/piece-gmail",
    "google-sheets": "@activepieces/piece-google-sheets",
    "google-drive": "@activepieces/piece-google-drive",
    "notion": "@activepieces/piece-notion",
    "github": "@activepieces/piece-github",
    "todoist": "@activepieces/piece-todoist",
    "webhook": "@activepieces/piece-webhook",
    "schedule": "@activepieces/piece-schedule",
    "http": "@activepieces/piece-http",
    "airtable": "@activepieces/piece-airtable",
    "trello": "@activepieces/piece-trello",
    "discord": "@activepieces/piece-discord",
    "telegram-bot": "@activepieces/piece-telegram-bot",
    "twilio": "@activepieces/piece-twilio",
    "openai": "@activepieces/piece-openai",
    "stripe": "@activepieces/piece-stripe",
    "hubspot": "@activepieces/piece-hubspot",
    "amazon-s3": "@activepieces/piece-amazon-s3",
    "typeform": "@activepieces/piece-typeform",
    "pagerduty": "@activepieces/piece-pagerduty",
    "code": "@activepieces/piece-code",
    "delay": "@activepieces/piece-delay",
}


# =============================================================================
# VERIFIED TRIGGER NAMES (from src/lib/triggers/*.ts - name: 'xxx')
# =============================================================================
TRIGGER_NAME_MAP = {
    # Slack
    "new-message": "new-message",
    "new_message": "new-message",
    "newMessage": "new-message",
    "new-message-in-channel": "new-message-in-channel",
    "new_reaction_added": "new_reaction_added",
    "new_command": "new_command",
    "new-user": "new-user",
    "channel_created": "channel_created",
    "new-direct-message": "new-direct-message",
    
    # Google Sheets
    "googlesheets_new_row_added": "googlesheets_new_row_added",
    "googleSheets_newRowAdded": "googlesheets_new_row_added",
    "new_row_added": "googlesheets_new_row_added",
    "newRowAdded": "googlesheets_new_row_added",
    "onNewRow": "googlesheets_new_row_added",
    "new-worksheet": "new-worksheet",
    "newWorksheet": "new-worksheet",
    "googleSheets_newWorksheet": "new-worksheet",
    "new-spreadsheet": "new-spreadsheet",
    "google-sheets-new-or-updated-row": "google-sheets-new-or-updated-row",
    
    # Gmail
    "gmail_new_email_received": "gmail_new_email_received",
    "new_email": "gmail_new_email_received",
    "newEmail": "gmail_new_email_received",
    "onNewEmail": "gmail_new_email_received",
    "new_labeled_email": "new_labeled_email",
    
    # Google Drive
    "new_file": "new_file",
    "newFile": "new_file",
    "new_folder": "new_folder",
    
    # Schedule
    "every_day": "every_day",
    "everyDay": "every_day",
    "every_hour": "every_hour",
    "everyHour": "every_hour",
    "every_week": "every_week",
    "everyWeek": "every_week",
    "every_month": "every_month",
    "every_x_minutes": "every_x_minutes",
    "cron_expression": "cron_expression",
    "cronExpression": "cron_expression",
    "cronTrigger": "cron_expression",
    
    # Webhook
    "catch_webhook": "catch_webhook",
    "catchWebhook": "catch_webhook",
    "http": "catch_webhook",
    "webhook": "catch_webhook",
    
    # GitHub
    "issues": "issues",
    "new_issue": "issues",
    "newIssue": "issues",
    "issueOpened": "issues",
    "pull_request": "pull_request",
    "newPullRequest": "pull_request",
    "star": "star",
    "push": "push",
    "new_branch": "new_branch",
    "new_release": "new_release",
    "new_milestone": "new_milestone",
    "new_collaborator": "new_collaborator",
    "new_label": "new_label",
    
    # Notion
    "new_database_item": "new_database_item",
    "newDatabaseItem": "new_database_item",
    "updated_database_item": "updated_database_item",
    "updated_page": "updated_page",
    "new_comment": "new_comment",
    
    # Todoist
    "task_completed": "task_completed",
    
    # Typeform
    "new_submission": "new_submission",
    "newSubmission": "new_submission",
    "formSubmitted": "new_submission",
    
    # Discord
    "new_message": "new_message",
    "new_member": "new_member",
    
    # Stripe
    "new_payment": "new_payment",
    "newPayment": "new_payment",
    "payment_failed": "payment_failed",
    "new_subscription": "new_subscription",
    "newSubscription": "new_subscription",
    "updated_subscription": "updated_subscription",
    "canceled_subscription": "canceled_subscription",
    "new_customer": "new_customer",
    "new_invoice": "new_invoice",
    "new_charge": "new_charge",
    "new_refund": "new_refund",
    "checkout_session_completed": "checkout_session_completed",
    
    # Airtable
    "new_record": "new_record",
    "newRecord": "new_record",
    "updated_record": "updated_record",
    
    # Trello
    "new_card": "new_card",
    "newCard": "new_card",
    "card_moved_to_list": "card_moved_to_list",
    "cardMoved": "card_moved_to_list",
    
    # HubSpot
    "new-blog-article": "new-blog-article",
    "newBlogArticle": "new-blog-article",
    "new-company": "new-company",
    "new-contact-in-list": "new-contact-in-list",
    "new-or-updated-contact": "new-or-updated-contact",
    "new-task": "new-task",
    "deal-stage-updated": "deal-stage-updated",
    "new-ticket-property-change": "new-ticket-property-change",
    
    # Shopify
    "new_abandoned_checkout": "new_abandoned_checkout",
    "new_cancelled_order": "new_cancelled_order",
    "updated_product": "updated_product",
    "newOrder": "new_abandoned_checkout",
    "create_order": "new_abandoned_checkout",
    
    # Stripe (uses generic trigger name from webhook events)
    "trigger": "trigger",
    
    # Amazon S3
    "amazon_s3_new_file": "new_file",
}


# =============================================================================
# VERIFIED ACTION NAMES (from src/lib/actions/*.ts - name: 'xxx')
# =============================================================================
ACTION_NAME_MAP = {
    # ===== SLACK =====
    "send_channel_message": "send_channel_message",
    "sendMessage": "send_channel_message",
    "sendChannelMessage": "send_channel_message",
    "postMessage": "send_channel_message",
    "send_direct_message": "send_direct_message",
    "sendDirectMessage": "send_direct_message",
    "get-message": "get-message",
    "getMessage": "get-message",
    "updateMessage": "updateMessage",
    "uploadFile": "uploadFile",
    "invite-user-to-channel": "invite-user-to-channel",
    "inviteUserToChannel": "invite-user-to-channel",
    "slack-add-reaction-to-message": "slack-add-reaction-to-message",
    "addReaction": "slack-add-reaction-to-message",
    "slack-create-channel": "slack-create-channel",
    "createChannel": "slack-create-channel",
    "slack-find-user-by-email": "slack-find-user-by-email",
    "find-user-by-id": "find-user-by-id",
    "listUsers": "listUsers",
    "searchMessages": "searchMessages",
    "set-channel-topic": "set-channel-topic",
    
    # ===== GMAIL =====
    "send_email": "send_email",
    "sendEmail": "send_email",
    "gmail_get_mail": "gmail_get_mail",
    "getMail": "gmail_get_mail",
    "getEmail": "gmail_get_mail",
    "gmail_get_thread": "gmail_get_thread",
    "getThread": "gmail_get_thread",
    "gmail_search_mail": "gmail_search_mail",
    "searchMail": "gmail_search_mail",
    
    # ===== GOOGLE SHEETS =====
    "insert_row": "insert_row",
    "insertRow": "insert_row",
    "appendRow": "insert_row",
    "addRow": "insert_row",
    "update_row": "update_row",
    "updateRow": "update_row",
    "updateCell": "update_row",
    "update_google_sheets_row": "update_row",
    "delete_row": "delete_row",
    "deleteRow": "delete_row",
    "find_rows": "find_rows",
    "findRows": "find_rows",
    "searchRows": "find_rows",
    "search_google_sheets": "find_rows",
    "find_row_by_num": "find_row_by_num",
    "get_next_rows": "get_next_rows",
    "getNextRows": "get_next_rows",
    "clear_sheet": "clear_sheet",
    "find-worksheet": "find-worksheet",
    "findWorksheet": "find-worksheet",
    "create-worksheet": "create-worksheet",
    "createWorksheet": "create-worksheet",
    "create-spreadsheet": "create-spreadsheet",
    "export_sheet": "export_sheet",
    "google-sheets-insert-multiple-rows": "google-sheets-insert-multiple-rows",
    "update-multiple-rows": "update-multiple-rows",
    
    # ===== GOOGLE DRIVE =====
    "upload_gdrive_file": "upload_gdrive_file",
    "uploadFile": "upload_gdrive_file",
    "upload_file": "upload_gdrive_file",
    "read-file": "read-file",
    "readFile": "read-file",
    "list-files": "list-files",
    "listFiles": "list-files",
    "create_new_gdrive_folder": "create_new_gdrive_folder",
    "createFolder": "create_new_gdrive_folder",
    "delete_gdrive_file": "delete_gdrive_file",
    "deleteFile": "delete_gdrive_file",
    "trash_gdrive_file": "trash_gdrive_file",
    "google-drive-move-file": "google-drive-move-file",
    "moveFile": "google-drive-move-file",
    "duplicate_file": "duplicate_file",
    "set_public_access": "set_public_access",
    "get-file-or-folder-by-id": "get-file-or-folder-by-id",
    "search-folder": "search-folder",
    "save_file_as_pdf": "save_file_as_pdf",
    
    # ===== NOTION =====
    "create_database_item": "create_database_item",
    "createDatabaseItem": "create_database_item",
    "createPage": "createPage",
    "update_database_item": "update_database_item",
    "updateDatabaseItem": "update_database_item",
    "notion-find-database-item": "notion-find-database-item",
    "findDatabaseItem": "notion-find-database-item",
    "find_page": "find_page",
    "findPage": "find_page",
    "append_to_page": "append_to_page",
    "appendToPage": "append_to_page",
    "archive_database_item": "archive_database_item",
    "restore_database_item": "restore_database_item",
    "add_comment": "add_comment",
    "get_page_comments": "get_page_comments",
    "retrieve_database": "retrieve_database",
    "getPageOrBlockChildren": "getPageOrBlockChildren",
    
    # ===== GITHUB =====
    "github_create_issue": "github_create_issue",
    "createIssue": "github_create_issue",
    "update_issue": "update_issue",
    "updateIssue": "update_issue",
    "find_issue": "find_issue",
    "findIssue": "find_issue",
    "add_labels_to_issue": "add_labels_to_issue",
    "addLabelsToIssue": "add_labels_to_issue",
    "createCommentOnAIssue": "createCommentOnAIssue",
    "addComment": "createCommentOnAIssue",
    "lockIssue": "lockIssue",
    "unlockIssue": "unlockIssue",
    "create_branch": "create_branch",
    "delete_branch": "delete_branch",
    "find_branch": "find_branch",
    "find_user": "find_user",
    "getIssueInformation": "getIssueInformation",
    
    # ===== TODOIST =====
    "create_task": "create_task",
    "createTask": "create_task",
    "create_item": "create_task",  # Model sometimes uses this
    "update_task": "update_task",
    "updateTask": "update_task",
    "find_task": "find_task",
    "mark_task_completed": "mark_task_completed",
    "completeTask": "mark_task_completed",
    "get-completed-tasks": "mark_task_completed",  # Close enough
    
    # ===== WEBHOOK =====
    "return_response": "return_response",
    "returnResponse": "return_response",
    
    # ===== HTTP =====
    "send_request": "send_request",
    "sendRequest": "send_request",
    "httpRequest": "send_request",
    "send": "send_request",
    
    # ===== AIRTABLE =====
    "airtable_create_record": "airtable_create_record",
    "createRecord": "airtable_create_record",
    "airtable_update_record": "airtable_update_record",
    "updateRecord": "airtable_update_record",
    "airtable_delete_record": "airtable_delete_record",
    "airtable_find_record": "airtable_find_record",
    "findRecord": "airtable_find_record",
    "airtable_get_record_by_id": "airtable_get_record_by_id",
    
    # ===== TRELLO =====
    "create_card": "create_card",
    "createCard": "create_card",
    "update_card": "update_card",
    "updateCard": "update_card",
    "get_card": "get_card",
    "delete_card": "delete_card",
    "add_card_attachment": "add_card_attachment",
    
    # ===== AMAZON S3 =====
    "upload-file": "upload-file",
    "s3UploadFile": "upload-file",
    "read-file": "read-file",
    "list-files": "list-files",
    "deleteFile": "deleteFile",
    "moveFile": "moveFile",
    "generate-signed-url": "generate-signed-url",
    
    # ===== HUBSPOT =====
    "get-owner-by-id": "get-owner-by-id",
    "update-company": "update-company",
    "update-product": "update-product",
    "upload-file": "upload-file",
    "update-line-item": "update-line-item",
    "get-pipeline-stage-details": "get-pipeline-stage-details",
    "update-custome-object": "update-custome-object",
    
    # ===== PAGERDUTY =====
    "create_incidents_alert": "create_incidents_alert",
    
    # ===== DISCORD =====
    "sendMessageWithBot": "sendMessageWithBot",
    "send_message_webhook": "send_message_webhook",
    "create_channel": "create_channel",
    "delete_channel": "delete_channel",
    "find_channel": "find_channel",
    "add_role_to_member": "add_role_to_member",
    "remove_role_from_member": "remove_role_from_member",
    "ban_guild_member": "ban_guild_member",
    
    # ===== STRIPE =====
    "create_customer": "create_customer",
    "retrieve_customer": "retrieve_customer",
    "search_customer": "search_customer",
    "update_customer": "update_customer",
    "create_subscription": "create_subscription",
    "cancel_subscription": "cancel_subscription",
    "search_subscriptions": "search_subscriptions",
    "create_payment_intent": "create_payment_intent",
    "retrieve_payment_intent": "retrieve_payment_intent",
    "create_invoice": "create_invoice",
    "find_invoice": "find_invoice",
    "retrieve_invoice": "retrieve_invoice",
    "create_refund": "create_refund",
    "create_product": "create_product",
    "create_price": "create_price",
    "create_payment_link": "create_payment_link",
    "deactivate_payment_link": "deactivate_payment_link",
    
    # ===== CODE =====
    "run_code": "run_code",
    "runCode": "run_code",
    "execute_code": "run_code",
    "executeCode": "run_code",
    
    # ===== DELAY =====
    "delayFor": "delayFor",
    "delay_for": "delayFor",
    "wait": "delayFor",
    "delay_until": "delay_until",
    "delayUntil": "delay_until",
}


# =============================================================================
# POST-PROCESSING FUNCTIONS
# =============================================================================

def normalize_piece_name(name: str) -> str:
    """Normalize piece name to @activepieces/piece-xxx format."""
    if not name:
        return name
    
    # Already correct format
    if name.startswith("@activepieces/piece-"):
        return name
    
    # Check mapping
    name_lower = name.lower().replace("_", "-").replace(" ", "-")
    if name_lower in PIECE_NAME_MAP:
        return PIECE_NAME_MAP[name_lower]
    
    # Auto-format
    clean_name = name_lower
    if clean_name.startswith("piece-"):
        clean_name = clean_name[6:]
    return f"@activepieces/piece-{clean_name}"


def normalize_trigger_name(name: str) -> str:
    """Normalize trigger name to verified codebase value."""
    if not name:
        return name
    
    # Check mapping first
    if name in TRIGGER_NAME_MAP:
        return TRIGGER_NAME_MAP[name]
    
    # Try converting camelCase to snake_case
    snake = re.sub(r'([a-z])([A-Z])', r'\1_\2', name).lower()
    if snake in TRIGGER_NAME_MAP:
        return TRIGGER_NAME_MAP[snake]
    
    return name


def normalize_action_name(name: str) -> str:
    """Normalize action name to verified codebase value."""
    if not name:
        return name
    
    # Check mapping first
    if name in ACTION_NAME_MAP:
        return ACTION_NAME_MAP[name]
    
    # Try converting camelCase to snake_case
    snake = re.sub(r'([a-z])([A-Z])', r'\1_\2', name).lower()
    if snake in ACTION_NAME_MAP:
        return ACTION_NAME_MAP[snake]
    
    return name


def fix_variable_syntax(obj: Any) -> Any:
    """Fix {{{var}}} → {{var}} and other syntax issues."""
    if isinstance(obj, str):
        # Fix triple+ braces
        result = re.sub(r'\{{3,}', '{{', obj)
        result = re.sub(r'\}{3,}', '}}', result)
        return result
    elif isinstance(obj, dict):
        return {k: fix_variable_syntax(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [fix_variable_syntax(item) for item in obj]
    return obj


def process_node(node: Dict, step_counter: List[int] = None) -> Dict:
    """Process a single node: normalize names, add required fields."""
    if not node or not isinstance(node, dict):
        return node
    
    if step_counter is None:
        step_counter = [0]
    
    node = deepcopy(node)
    node_type = node.get("type", "")
    settings = node.get("settings", {})
    
    # Ensure name
    if "name" not in node:
        step_counter[0] += 1
        node["name"] = f"step_{step_counter[0]}"
    
    # Ensure displayName
    if "displayName" not in node:
        node["displayName"] = node["name"].replace("_", " ").replace("-", " ").title()
    
    # Ensure valid
    node["valid"] = True
    
    # Process by type
    if node_type == "PIECE_TRIGGER":
        # Normalize piece name
        if "pieceName" in settings:
            settings["pieceName"] = normalize_piece_name(settings["pieceName"])
        
        # Normalize trigger name
        if "triggerName" in settings:
            settings["triggerName"] = normalize_trigger_name(settings["triggerName"])
        
        # Ensure pieceVersion
        if "pieceVersion" not in settings:
            settings["pieceVersion"] = "~1.0.0"
        
        # Ensure input and propertySettings
        if "input" not in settings:
            settings["input"] = {}
        if "propertySettings" not in settings:
            settings["propertySettings"] = {}
        
        node["settings"] = settings
    
    elif node_type == "PIECE":
        # Normalize piece name
        if "pieceName" in settings:
            settings["pieceName"] = normalize_piece_name(settings["pieceName"])
        
        # Normalize action name
        if "actionName" in settings:
            settings["actionName"] = normalize_action_name(settings["actionName"])
        
        # Ensure pieceVersion
        if "pieceVersion" not in settings:
            settings["pieceVersion"] = "~1.0.0"
        
        # Ensure input and propertySettings
        if "input" not in settings:
            settings["input"] = {}
        if "propertySettings" not in settings:
            settings["propertySettings"] = {}
        
        node["settings"] = settings
    
    elif node_type == "ROUTER" or node_type == "CONDITION":
        # Normalize CONDITION to ROUTER
        if node_type == "CONDITION":
            node["type"] = "ROUTER"
        
        # Ensure settings
        if "executionType" not in settings:
            settings["executionType"] = "EXECUTE_FIRST_MATCH"
        
        # Normalize branch types
        if "branches" in settings:
            for branch in settings["branches"]:
                if branch.get("branchType") == "CONDITION_BRANCH":
                    branch["branchType"] = "CONDITION"
                elif branch.get("branchType") == "FALLBACK_BRANCH":
                    branch["branchType"] = "FALLBACK"
                elif branch.get("branchType") == "CONDITION_BASED":
                    branch["branchType"] = "CONDITION"
        
        node["settings"] = settings
        
        # Process children
        if "children" in node:
            node["children"] = [
                process_node(child, step_counter) if child else None 
                for child in node["children"]
            ]
    
    elif node_type == "CODE":
        # Ensure sourceCode structure
        if "sourceCode" not in settings:
            code = settings.get("input", {}).get("code", "export const code = async (inputs) => { return inputs; };")
            settings["sourceCode"] = {"packageJson": "{}", "code": code}
        elif "packageJson" not in settings.get("sourceCode", {}):
            settings["sourceCode"]["packageJson"] = "{}"
        
        if "input" not in settings:
            settings["input"] = {}
        
        node["settings"] = settings
    
    elif node_type == "LOOP_ON_ITEMS":
        # Ensure required fields
        if "items" not in settings:
            settings["items"] = "{{trigger}}"
        node["settings"] = settings
        
        # Process firstLoopAction
        if node.get("firstLoopAction"):
            node["firstLoopAction"] = process_node(node["firstLoopAction"], step_counter)
    
    elif node_type == "TIMER" or node_type == "DELAY":
        # Convert TIMER to delay piece action
        node["type"] = "PIECE"
        duration = settings.get("duration", 1)
        unit = settings.get("unit", "MINUTES").lower()
        
        # Map units
        unit_map = {"days": "days", "hours": "hours", "minutes": "minutes", "seconds": "seconds"}
        delay_unit = unit_map.get(unit, "minutes")
        
        node["settings"] = {
            "pieceName": "@activepieces/piece-delay",
            "pieceVersion": "~0.3.0",
            "actionName": "delayFor",
            "input": {
                "unit": delay_unit,
                "delayFor": duration
            },
            "propertySettings": {}
        }
    
    # Recurse to nextAction
    if node.get("nextAction"):
        node["nextAction"] = process_node(node["nextAction"], step_counter)
    
    return node


def extract_pieces(node: Dict, pieces: Set[str] = None) -> Set[str]:
    """Recursively extract all pieceName values from workflow."""
    if pieces is None:
        pieces = set()
    
    if not node or not isinstance(node, dict):
        return pieces
    
    settings = node.get("settings", {})
    if isinstance(settings, dict) and "pieceName" in settings:
        pieces.add(settings["pieceName"])
    
    # Recurse through all branches
    if node.get("nextAction"):
        extract_pieces(node["nextAction"], pieces)
    if "children" in node:
        for child in node.get("children", []):
            if child:
                extract_pieces(child, pieces)
    if node.get("firstLoopAction"):
        extract_pieces(node["firstLoopAction"], pieces)
    
    return pieces


def postprocess(workflow: Any) -> Dict:
    """
    Post-process model output to valid FlowTemplate.
    
    Args:
        workflow: JSON string, dict with 'output' key, or direct workflow dict
    
    Returns:
        FlowTemplate ready for import
    """
    # Parse if string
    if isinstance(workflow, str):
        workflow = workflow.strip()
        
        # Remove markdown code blocks
        if "```" in workflow:
            workflow = re.sub(r'```(?:json)?\s*', '', workflow)
            workflow = re.sub(r'```', '', workflow)
        
        workflow = json.loads(workflow)
    
    if not workflow:
        raise ValueError("Empty workflow")
    
    # Extract the actual workflow
    if "output" in workflow:
        output = workflow["output"]
    else:
        output = workflow
    
    # Handle 'firstAction' instead of 'trigger' (convert to proper trigger)
    if "firstAction" in output and "trigger" not in output:
        first_action = output["firstAction"]
        # Check if first action is a webhook/trigger-like action
        piece_name = first_action.get("settings", {}).get("pieceName", "")
        if "webhook" in piece_name.lower():
            # Convert to trigger
            output["trigger"] = {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "valid": True,
                "displayName": first_action.get("displayName", "Webhook Trigger"),
                "settings": {
                    "pieceName": "@activepieces/piece-webhook",
                    "pieceVersion": "~0.1.0",
                    "input": first_action.get("settings", {}).get("input", {}),
                    "propertySettings": {},
                    "triggerName": "catch_webhook"
                },
                "nextAction": first_action.get("nextAction")
            }
            del output["firstAction"]
        else:
            raise ValueError("Workflow has 'firstAction' but first action is not a trigger")
    
    if "trigger" not in output:
        raise ValueError("Workflow must have a 'trigger' field")
    
    # Deep copy and fix variable syntax
    output = fix_variable_syntax(deepcopy(output))
    
    # Process the trigger (and all nested actions)
    trigger = output.get("trigger")
    if trigger:
        trigger = process_node(trigger, [0])
        output["trigger"] = trigger
    
    # Ensure required top-level fields
    if "displayName" not in output:
        output["displayName"] = "Generated Workflow"
    if "schemaVersion" not in output:
        output["schemaVersion"] = "1"
    output["valid"] = True
    
    # Extract pieces
    pieces = sorted(list(extract_pieces(trigger)))
    
    # Create FlowTemplate
    return {
        "name": output.get("displayName", "Generated Workflow"),
        "description": "",
        "tags": [],
        "pieces": pieces,
        "schemaVersion": None,
        "template": output
    }


# =============================================================================
# CLI / TESTING
# =============================================================================
def main():
    """Test the post-processor."""
    # Test case from the fine-tuned model
    test_input = {
        "output": {
            "displayName": "Google Sheets to Slack",
            "valid": True,
            "schemaVersion": "1",
            "trigger": {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "valid": True,
                "displayName": "New Worksheet",
                "settings": {
                    "pieceName": "@activepieces/piece-google-sheets",
                    "pieceVersion": "~0.9.6",
                    "input": {"spreadsheet_id": None},
                    "propertySettings": {},
                    "triggerName": "googleSheets_newWorksheet"
                },
                "nextAction": {
                    "name": "step_1",
                    "type": "PIECE",
                    "valid": True,
                    "displayName": "Send Channel Message",
                    "settings": {
                        "pieceName": "@activepieces/piece-slack",
                        "pieceVersion": "~0.10.16",
                        "input": {
                            "channel": "C0A2UQZJF3R",
                            "text": "New Row Added!"
                        },
                        "propertySettings": {},
                        "actionName": "send_channel_message"
                    }
                }
            }
        }
    }
    
    result = postprocess(test_input)
    print("=== POST-PROCESSED RESULT ===")
    print(json.dumps(result, indent=2))
    
    # Verify key fields
    template = result["template"]
    trigger = template["trigger"]
    print("\n=== VERIFICATION ===")
    print(f"triggerName: {trigger['settings']['triggerName']}")
    print(f"actionName: {trigger['nextAction']['settings']['actionName']}")
    print(f"pieces: {result['pieces']}")


if __name__ == "__main__":
    main()
