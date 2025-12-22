#!/usr/bin/env python3
"""
Robust Post-Processor for Fine-Tuned Model Outputs.

All mappings verified against actual Activepieces codebase.
Enhanced with comprehensive error handling and auto-corrections.
Now includes SmartMatcher for intelligent fuzzy matching of trigger/action names.
"""

import json
import re
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple, Set
from copy import deepcopy

# Try to import smart matcher (handles cases where it's not available)
try:
    from smart_matcher import smart_match_trigger, smart_match_action, FUZZY_AVAILABLE
    SMART_MATCHER_AVAILABLE = True
    print(f"[PostProcessor] SmartMatcher loaded (fuzzy={'enabled' if FUZZY_AVAILABLE else 'disabled'})")
except ImportError:
    SMART_MATCHER_AVAILABLE = False
    print("[PostProcessor] SmartMatcher not available, using static mappings only")

# =============================================================================
# PIECE REGISTRY (dynamically loaded)
# =============================================================================
PIECE_REGISTRY: Dict[str, str] = {}

def load_piece_registry() -> Dict[str, str]:
    """Load piece registry from JSON file."""
    global PIECE_REGISTRY
    if PIECE_REGISTRY:
        return PIECE_REGISTRY
    
    registry_file = Path(__file__).parent / "piece_registry.json"
    if registry_file.exists():
        try:
            with open(registry_file, "r", encoding="utf-8") as f:
                PIECE_REGISTRY = json.load(f)
                return PIECE_REGISTRY
        except Exception as e:
            print(f"[PostProcessor] Warning: Could not load piece registry: {e}")
    
    # Fallback to hardcoded versions (comprehensive)
    PIECE_REGISTRY = {
        "slack": "~0.12.16",
        "gmail": "~0.9.6",
        "google-sheets": "~0.12.20",
        "google-drive": "~0.5.34",
        "webhook": "~0.3.25",
        "schedule": "~0.1.25",
        "github": "~0.5.13",
        "discord": "~0.4.29",
        "notion": "~0.5.13",
        "airtable": "~0.5.2",
        "trello": "~0.3.15",
        "stripe": "~0.3.12",
        "hubspot": "~0.5.13",
        "typeform": "~0.3.14",
        "todoist": "~0.3.7",
        "http": "~0.4.8",
        "openai": "~0.3.7",
        "twilio": "~0.3.7",
        "shopify": "~0.3.7",
        "amazon-s3": "~0.3.7",
        "delay": "~0.3.0",
        "code": "~0.3.0",
        "dropbox": "~0.5.11",
        "telegram-bot": "~0.3.7",
        "mailchimp": "~0.3.7",
        "linear": "~0.3.7",
        "jira-cloud": "~0.3.7",
        "asana": "~0.3.7",
        "clickup": "~0.3.7",
        "monday": "~0.3.7",
        "zendesk": "~0.3.7",
        "intercom": "~0.3.7",
        "sendgrid": "~0.3.7",
        "mailgun": "~0.3.7",
        "wordpress": "~0.3.7",
        "twitter": "~0.3.7",
        "facebook-pages": "~0.3.7",
        "instagram-business": "~0.3.7",
        "linkedin": "~0.3.7",
        "calendly": "~0.3.7",
        "zoom": "~0.3.7",
        "microsoft-teams": "~0.3.7",
        "salesforce": "~0.3.7",
        "pipedrive": "~0.3.7",
        "freshdesk": "~0.3.7",
        "freshsales": "~0.3.7",
        "pagerduty": "~0.3.7",
        "datadog": "~0.3.7",
        "sentry": "~0.3.7",
        "supabase": "~0.3.7",
        "firebase": "~0.3.7",
        "mongodb": "~0.3.7",
        "mysql": "~0.3.7",
        "postgres": "~0.3.7",
        "redis": "~0.3.7",
        "rss": "~0.1.15",
        "text-helper": "~0.3.0",
        "date-helper": "~0.3.0",
        "math-helper": "~0.3.0",
        "json-helper": "~0.3.0",
        "xml": "~0.3.0",
        "csv": "~0.3.0",
        "pdf": "~0.3.0",
        "image": "~0.3.0",
        "qrcode": "~0.3.0",
        "forms": "~0.3.0",
    }
    return PIECE_REGISTRY


# =============================================================================
# ACTION → PIECE CORRECTIONS (when action is on wrong piece)
# =============================================================================
ACTION_TO_PIECE_MAP = {
    # Webhook actions (CRITICAL - model often puts on http piece)
    "return_response": "@activepieces/piece-webhook",
    "returnResponse": "@activepieces/piece-webhook",
    
    # Gmail actions
    "send_email": "@activepieces/piece-gmail",
    "gmail_get_mail": "@activepieces/piece-gmail",
    "gmail_search_mail": "@activepieces/piece-gmail",
    "gmail_get_thread": "@activepieces/piece-gmail",
    
    # Google Sheets actions
    "insert_row": "@activepieces/piece-google-sheets",
    "update_row": "@activepieces/piece-google-sheets",
    "delete_row": "@activepieces/piece-google-sheets",
    "find_rows": "@activepieces/piece-google-sheets",
    "find_row_by_num": "@activepieces/piece-google-sheets",
    "clear_sheet": "@activepieces/piece-google-sheets",
    
    # Google Drive actions
    "upload_gdrive_file": "@activepieces/piece-google-drive",
    "create_new_gdrive_folder": "@activepieces/piece-google-drive",
    "delete_gdrive_file": "@activepieces/piece-google-drive",
    "trash_gdrive_file": "@activepieces/piece-google-drive",
    
    # Slack actions
    "send_channel_message": "@activepieces/piece-slack",
    "send_direct_message": "@activepieces/piece-slack",
    "invite-user-to-channel": "@activepieces/piece-slack",
    "slack-create-channel": "@activepieces/piece-slack",
    
    # Notion actions
    "create_database_item": "@activepieces/piece-notion",
    "update_database_item": "@activepieces/piece-notion",
    "notion-find-database-item": "@activepieces/piece-notion",
    "createPage": "@activepieces/piece-notion",
    "append_to_page": "@activepieces/piece-notion",
    
    # Airtable actions
    "airtable_create_record": "@activepieces/piece-airtable",
    "airtable_update_record": "@activepieces/piece-airtable",
    "airtable_find_record": "@activepieces/piece-airtable",
    "airtable_delete_record": "@activepieces/piece-airtable",
    
    # GitHub actions
    "github_create_issue": "@activepieces/piece-github",
    "update_issue": "@activepieces/piece-github",
    "find_issue": "@activepieces/piece-github",
    "createCommentOnAIssue": "@activepieces/piece-github",
    
    # Todoist actions
    "create_task": "@activepieces/piece-todoist",
    "mark_task_completed": "@activepieces/piece-todoist",
    "update_task": "@activepieces/piece-todoist",
    
    # HTTP actions
    "send_request": "@activepieces/piece-http",
    
    # Code actions
    "run_code": "@activepieces/piece-code",
    
    # Delay actions
    "delayFor": "@activepieces/piece-delay",
    "delay_until": "@activepieces/piece-delay",
    
    # OpenAI actions
    "ask_chatgpt": "@activepieces/piece-openai",
    "vision": "@activepieces/piece-openai",
    "generate_image": "@activepieces/piece-openai",
    "transcribe_audio": "@activepieces/piece-openai",
    "text_to_speech": "@activepieces/piece-openai",
    
    # Twilio actions
    "send_sms": "@activepieces/piece-twilio",
    
    # Trello actions
    "create_card": "@activepieces/piece-trello",
    "update_card": "@activepieces/piece-trello",
    
    # Discord actions
    "sendMessageWithBot": "@activepieces/piece-discord",
    "send_message_webhook": "@activepieces/piece-discord",
    
    # Stripe actions
    "create_customer": "@activepieces/piece-stripe",
    "retrieve_customer": "@activepieces/piece-stripe",
    "create_subscription": "@activepieces/piece-stripe",
    "create_payment_intent": "@activepieces/piece-stripe",
    "create_invoice": "@activepieces/piece-stripe",
}

def get_piece_version(piece_name: str) -> str:
    """Get version for a piece from registry."""
    registry = load_piece_registry()
    
    # Extract short name from @activepieces/piece-xxx
    short_name = piece_name
    if piece_name.startswith("@activepieces/piece-"):
        short_name = piece_name.replace("@activepieces/piece-", "")
    
    # Try exact match
    if short_name in registry:
        return registry[short_name]
    
    # Try normalized (hyphens, underscores)
    normalized = short_name.lower().replace("_", "-")
    if normalized in registry:
        return registry[normalized]
    
    # Default fallback
    return "~0.0.0"


# =============================================================================
# VERIFIED PIECE NAMES (from packages/pieces/community/*/package.json)
# =============================================================================
PIECE_NAME_MAP = {
    # Common aliases → canonical names
    "slack": "@activepieces/piece-slack",
    "gmail": "@activepieces/piece-gmail",
    "google-sheets": "@activepieces/piece-google-sheets",
    "googlesheets": "@activepieces/piece-google-sheets",
    "sheets": "@activepieces/piece-google-sheets",
    "google-drive": "@activepieces/piece-google-drive",
    "googledrive": "@activepieces/piece-google-drive",
    "gdrive": "@activepieces/piece-google-drive",
    "drive": "@activepieces/piece-google-drive",
    "notion": "@activepieces/piece-notion",
    "github": "@activepieces/piece-github",
    "todoist": "@activepieces/piece-todoist",
    "webhook": "@activepieces/piece-webhook",
    "webhooks": "@activepieces/piece-webhook",
    "schedule": "@activepieces/piece-schedule",
    "scheduler": "@activepieces/piece-schedule",
    "cron": "@activepieces/piece-schedule",
    "http": "@activepieces/piece-http",
    "http-request": "@activepieces/piece-http",
    "api": "@activepieces/piece-http",
    "airtable": "@activepieces/piece-airtable",
    "trello": "@activepieces/piece-trello",
    "discord": "@activepieces/piece-discord",
    "telegram": "@activepieces/piece-telegram-bot",
    "telegram-bot": "@activepieces/piece-telegram-bot",
    "twilio": "@activepieces/piece-twilio",
    "sms": "@activepieces/piece-twilio",
    "openai": "@activepieces/piece-openai",
    "chatgpt": "@activepieces/piece-openai",
    "gpt": "@activepieces/piece-openai",
    "stripe": "@activepieces/piece-stripe",
    "hubspot": "@activepieces/piece-hubspot",
    "amazon-s3": "@activepieces/piece-amazon-s3",
    "s3": "@activepieces/piece-amazon-s3",
    "aws-s3": "@activepieces/piece-amazon-s3",
    "typeform": "@activepieces/piece-typeform",
    "pagerduty": "@activepieces/piece-pagerduty",
    "code": "@activepieces/piece-code",
    "javascript": "@activepieces/piece-code",
    "delay": "@activepieces/piece-delay",
    "wait": "@activepieces/piece-delay",
    "timer": "@activepieces/piece-delay",
    "dropbox": "@activepieces/piece-dropbox",
    "box": "@activepieces/piece-box",
    "onedrive": "@activepieces/piece-microsoft-onedrive",
    "microsoft-onedrive": "@activepieces/piece-microsoft-onedrive",
    "jira": "@activepieces/piece-jira-cloud",
    "jira-cloud": "@activepieces/piece-jira-cloud",
    "linear": "@activepieces/piece-linear",
    "asana": "@activepieces/piece-asana",
    "clickup": "@activepieces/piece-clickup",
    "monday": "@activepieces/piece-monday",
    "zendesk": "@activepieces/piece-zendesk",
    "intercom": "@activepieces/piece-intercom",
    "sendgrid": "@activepieces/piece-sendgrid",
    "mailgun": "@activepieces/piece-mailgun",
    "mailchimp": "@activepieces/piece-mailchimp",
    "salesforce": "@activepieces/piece-salesforce",
    "pipedrive": "@activepieces/piece-pipedrive",
    "freshdesk": "@activepieces/piece-freshdesk",
    "shopify": "@activepieces/piece-shopify",
    "woocommerce": "@activepieces/piece-woocommerce",
    "wordpress": "@activepieces/piece-wordpress",
    "twitter": "@activepieces/piece-twitter",
    "x": "@activepieces/piece-twitter",
    "facebook": "@activepieces/piece-facebook-pages",
    "facebook-pages": "@activepieces/piece-facebook-pages",
    "instagram": "@activepieces/piece-instagram-business",
    "linkedin": "@activepieces/piece-linkedin",
    "calendly": "@activepieces/piece-calendly",
    "zoom": "@activepieces/piece-zoom",
    "microsoft-teams": "@activepieces/piece-microsoft-teams",
    "teams": "@activepieces/piece-microsoft-teams",
    "supabase": "@activepieces/piece-supabase",
    "firebase": "@activepieces/piece-firebase",
    "mongodb": "@activepieces/piece-mongodb",
    "mysql": "@activepieces/piece-mysql",
    "postgres": "@activepieces/piece-postgres",
    "postgresql": "@activepieces/piece-postgres",
    "redis": "@activepieces/piece-redis",
    "rss": "@activepieces/piece-rss",
    "messagebird": "@activepieces/piece-messagebird",
    "smtp": "@activepieces/piece-smtp",
    "email": "@activepieces/piece-gmail",  # Default email to gmail
}

# =============================================================================
# PIECE NAME CORRECTIONS (for model-generated wrong names with @activepieces/piece- prefix)
# Only add pieces here that the model generates INCORRECTLY
# =============================================================================
PIECE_NAME_CORRECTIONS = {
    # Model generates "discord-bot" but the actual piece is "discord"
    "discord-bot": "discord",
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
    "new_mention": "new_mention",  # From training data
    "newMention": "new_mention",
    
    # Google Sheets
    "googlesheets_new_row_added": "googlesheets_new_row_added",
    "googleSheets_newRowAdded": "googlesheets_new_row_added",
    "new_row_added": "googlesheets_new_row_added",
    "newRowAdded": "googlesheets_new_row_added",
    "onNewRow": "googlesheets_new_row_added",
    "new-worksheet": "new-worksheet",
    "new_worksheet": "new-worksheet",  # underscore variant
    "newWorksheet": "new-worksheet",
    "googleSheets_newWorksheet": "new-worksheet",
    "new-spreadsheet": "new-spreadsheet",
    "new_spreadsheet": "new-spreadsheet",  # underscore variant
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
    "new_star": "star",
    "newStar": "star",
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
    "new_message_created": "new_message",  # Model generates this variant
    "newMessageCreated": "new_message",
    "new_member": "new_member",
    
    # Stripe
    "new_payment": "new_payment",
    "newPayment": "new_payment",
    "payment_intent_succeeded": "new_payment",  # Model generates this variant
    "paymentIntentSucceeded": "new_payment",
    "payment_succeeded": "new_payment",
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
    
    # WooCommerce (verified trigger names from index.ts)
    "newOrder": "order_created",
    "new_order": "order_created",
    "create_order": "order_created",
    "order_created": "order_created",
    "order_updated": "order_updated",
    "order_deleted": "order_deleted",
    "product_created": "product_created",
    "product_updated": "product_updated",
    "product_deleted": "product_deleted",
    "customer_created": "customer_created",
    "customer_updated": "customer_updated",
    "customer_deleted": "customer_deleted",
    "coupon_created": "coupon_created",
    "coupon_updated": "coupon_updated",
    "coupon_deleted": "coupon_deleted",
    
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
    "request_approval_message": "request_approval_message",  # From training data
    "requestApprovalMessage": "request_approval_message",
    
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
    "read_row": "find_rows",  # read_row doesn't exist, map to find_rows
    "readRow": "find_rows",
    "read_rows": "find_rows",
    "readRows": "find_rows",
    "get_row": "find_row_by_num",
    "getRow": "find_row_by_num",
    "get_rows": "find_rows",
    "getRows": "find_rows",
    "export_sheet": "export_sheet",  # From training data
    "exportSheet": "export_sheet",
    "google-sheets-insert-multiple-rows": "google-sheets-insert-multiple-rows",  # From training data
    "insert_multiple_rows": "google-sheets-insert-multiple-rows",
    "insertMultipleRows": "google-sheets-insert-multiple-rows",
    "read_next_row": "get_next_rows",  # Common model mistake
    "readNextRow": "get_next_rows",
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
    "getPageOrBlockChildren": "getPageOrBlockChildren",  # From training data
    "get_page_or_block_children": "getPageOrBlockChildren",
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
    
    # ===== HTTP → Webhook Response (common model mistake) =====
    "send_response": "return_response",  # Model often puts this on http piece
    "sendResponse": "return_response",
    
    # ===== AIRTABLE =====
    "airtable_create_record": "airtable_create_record",
    "createRecord": "airtable_create_record",
    "airtable_update_record": "airtable_update_record",
    "update_record": "airtable_update_record",  # Model sometimes uses this
    "updateRecord": "airtable_update_record",
    "airtable_delete_record": "airtable_delete_record",
    "airtable_find_record": "airtable_find_record",
    "findRecord": "airtable_find_record",
    "airtable_find_records": "airtable_find_record",  # Also check plural
    "find_records": "airtable_find_record",
    "airtable_get_record_by_id": "airtable_get_record_by_id",
    
    # ===== MAILCHIMP =====
    "add_member_to_list": "add_member_to_list",
    "add_member_to_a_list": "add_member_to_list",  # Model adds extra "a"
    "addMemberToList": "add_member_to_list",
    "subscribe_member": "add_member_to_list",
    "add_subscriber": "add_member_to_list",
    "add_to_list": "add_member_to_list",
    "add_note_to_subscriber": "add_note_to_subscriber",
    "add_tag_to_subscriber": "add_tag_to_subscriber",
    "update_subscriber_status": "update_subscriber_status",
    
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
    "run_javascript": "run_code",
    "runJavascript": "run_code",
    "code": "run_code",
    
    # ===== DELAY =====
    "delayFor": "delayFor",
    "delay_for": "delayFor",
    "wait": "delayFor",
    "delay": "delayFor",
    "delay_until": "delay_until",
    "delayUntil": "delay_until",
    "waitUntil": "delay_until",
    
    # ===== OPENAI =====
    "ask_chatgpt": "ask_chatgpt",
    "askChatGPT": "ask_chatgpt",
    "chat_completion": "ask_chatgpt",
    "chatCompletion": "ask_chatgpt",
    "generate_text": "ask_chatgpt",
    "text_completion": "ask_chatgpt",
    "gpt4": "ask_chatgpt",
    "gpt-4": "ask_chatgpt",
    "gpt3": "ask_chatgpt",
    "gpt-3": "ask_chatgpt",
    "vision": "vision",
    "generate_image": "generate_image",
    "dall_e": "generate_image",
    "dalle": "generate_image",
    "transcribe_audio": "transcribe_audio",
    "whisper": "transcribe_audio",
    "text_to_speech": "text_to_speech",
    "tts": "text_to_speech",
    
    # ===== TWILIO =====
    "send_sms": "send_sms",
    "sendSms": "send_sms",
    "sendSMS": "send_sms",
    "sms": "send_sms",
    
    # ===== SENDGRID =====
    "sendEmail": "send_email",
    "sendgrid_send_email": "send_email",
    
    # ===== TELEGRAM =====
    "send_text_message": "send_text_message",
    "sendTextMessage": "send_text_message",
    "telegram_send": "send_text_message",
    "send_message": "send_text_message",  # Common model mistake
    "send_media": "send_media",  # From training data
    "sendMedia": "send_media",
    "get_chat_member": "get_chat_member",  # From training data
    "getChatMember": "get_chat_member",
    
    # ===== SHOPIFY =====
    "create_product": "create_product",
    "update_product": "update_product",
    "get_product": "get_product",
    "create_order": "create_order",
    "update_order": "update_order",
    "get_order": "get_order",
    
    # ===== LINEAR =====
    # Note: Linear uses `linear_create_issue`, but model generates `create_issue`
    # This is handled by PIECE_SPECIFIC_ACTION_FIXES below
    "linear_create_issue": "linear_create_issue",
    "linear_update_issue": "linear_update_issue",
    
    # ===== JIRA =====
    "create_jira_issue": "create_issue",
    "jira_create_issue": "create_issue",
    "update_jira_issue": "update_issue",
    
    # ===== ASANA =====
    "create_asana_task": "create_task",
    "asana_create_task": "create_task",
    
    # ===== CLICKUP =====
    "create_clickup_task": "create_task",
    "clickup_create_task": "create_task",
    
    # ===== SALESFORCE =====
    "create_lead": "create_lead",
    "update_lead": "update_lead",
    "create_contact": "create_contact",
    "update_contact": "update_contact",
    "create_opportunity": "create_opportunity",
    
    # ===== SUPABASE =====
    "insert_row": "insert_row",
    "supabase_insert": "insert_row",
    "select_rows": "select_rows",
    "supabase_select": "select_rows",
    
    # ===== MONGODB =====
    "insert_document": "insert_document",
    "find_documents": "find_documents",
    "update_document": "update_document",
    
    # ===== FORMS =====
    "wait_for_approval": "wait_for_approval",
    "request_approval": "wait_for_approval",
    "approval": "wait_for_approval",
}


# =============================================================================
# TRIGGER → PIECE CORRECTIONS (when trigger is on wrong piece)
# =============================================================================
TRIGGER_TO_PIECE_MAP = {
    # Schedule triggers
    "every_day": "@activepieces/piece-schedule",
    "every_hour": "@activepieces/piece-schedule",
    "every_week": "@activepieces/piece-schedule",
    "every_month": "@activepieces/piece-schedule",
    "every_x_minutes": "@activepieces/piece-schedule",
    "cron_expression": "@activepieces/piece-schedule",
    
    # Webhook triggers
    "catch_webhook": "@activepieces/piece-webhook",
    
    # Gmail triggers
    "gmail_new_email_received": "@activepieces/piece-gmail",
    "new_labeled_email": "@activepieces/piece-gmail",
    
    # Google Sheets triggers
    "googlesheets_new_row_added": "@activepieces/piece-google-sheets",
    "new-worksheet": "@activepieces/piece-google-sheets",
    "new-spreadsheet": "@activepieces/piece-google-sheets",
    
    # GitHub triggers
    "issues": "@activepieces/piece-github",
    "pull_request": "@activepieces/piece-github",
    "star": "@activepieces/piece-github",
    "push": "@activepieces/piece-github",
    
    # Stripe triggers
    "new_payment": "@activepieces/piece-stripe",
    "new_subscription": "@activepieces/piece-stripe",
    "new_customer": "@activepieces/piece-stripe",
}


# =============================================================================
# PIECE-SPECIFIC ACTION NAME CORRECTIONS
# =============================================================================
# Some pieces have non-standard action names. When the model generates a generic
# action name for a specific piece, we need to correct it to the piece-specific name.
# Format: { piece_name: { model_output: correct_action_name } }

PIECE_SPECIFIC_ACTION_FIXES = {
    "@activepieces/piece-linear": {
        "create_issue": "linear_create_issue",
        "createIssue": "linear_create_issue",
        "update_issue": "linear_update_issue",
        "updateIssue": "linear_update_issue",
    },
    "@activepieces/piece-github": {
        "create_issue": "github_create_issue",
        "createIssue": "github_create_issue",
    },
    "@activepieces/piece-telegram-bot": {
        "send_message": "send_text_message",
        "sendMessage": "send_text_message",
    },
}


# =============================================================================
# POST-PROCESSING FUNCTIONS
# =============================================================================

def _is_valid_version(version: str) -> bool:
    """Check if version matches required pattern: ^([~^])?[0-9]+\\.[0-9]+\\.[0-9]+$"""
    if not version:
        return False
    pattern = r'^([~^])?[0-9]+\.[0-9]+\.[0-9]+$'
    return bool(re.match(pattern, version))


def ensure_property_settings(property_settings: Dict) -> Dict:
    """Ensure all propertySettings entries have required 'type' field."""
    if not isinstance(property_settings, dict):
        return {}
    
    result = {}
    for key, value in property_settings.items():
        if isinstance(value, dict):
            # If it's already a dict, ensure it has 'type'
            if "type" not in value:
                result[key] = {**value, "type": "MANUAL"}
            else:
                result[key] = value
        else:
            # If it's not a dict, convert to dict with type
            result[key] = {"type": "MANUAL"}
    
    # Special handling for authFields - ensure it always has type
    if "authFields" in result:
        if not isinstance(result["authFields"], dict):
            result["authFields"] = {"type": "MANUAL"}
        elif "type" not in result["authFields"]:
            result["authFields"]["type"] = "MANUAL"
    
    return result


def normalize_piece_name(name: str) -> str:
    """Normalize piece name to @activepieces/piece-xxx format."""
    if not name:
        return name
    
    # Already has correct format prefix
    if name.startswith("@activepieces/piece-"):
        # Check if this specific piece needs correction (e.g., discord-bot → discord)
        short_name = name.replace("@activepieces/piece-", "")
        if short_name in PIECE_NAME_CORRECTIONS:
            return f"@activepieces/piece-{PIECE_NAME_CORRECTIONS[short_name]}"
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


def extract_misplaced_actions(settings: Dict) -> Optional[Dict]:
    """
    Extract actions that are incorrectly placed inside settings.
    Model sometimes puts firstLoopAction, nextAction, firstLoopChild inside settings instead of node level.
    Returns the extracted action chain if found.
    """
    extracted = None
    
    # Check for misplaced firstLoopAction in settings
    if "firstLoopAction" in settings:
        extracted = settings.pop("firstLoopAction")
        print(f"[PostProcessor] Extracted misplaced 'firstLoopAction' from settings")
    
    # Check for misplaced firstLoopChild in settings (model variant)
    if "firstLoopChild" in settings:
        action = settings.pop("firstLoopChild")
        if extracted:
            current = extracted
            while current.get("nextAction"):
                current = current["nextAction"]
            current["nextAction"] = action
        else:
            extracted = action
        print(f"[PostProcessor] Extracted misplaced 'firstLoopChild' from settings")
    
    # Check for misplaced loopAction in settings
    if "loopAction" in settings:
        action = settings.pop("loopAction")
        if extracted:
            current = extracted
            while current.get("nextAction"):
                current = current["nextAction"]
            current["nextAction"] = action
        else:
            extracted = action
        print(f"[PostProcessor] Extracted misplaced 'loopAction' from settings")
    
    # Check for misplaced nextAction in settings (outside of input)
    if "nextAction" in settings and "input" in settings:
        # nextAction should be at node level, not settings level
        if extracted:
            # Chain the extracted action
            current = extracted
            while current.get("nextAction"):
                current = current["nextAction"]
            current["nextAction"] = settings.pop("nextAction")
        else:
            extracted = settings.pop("nextAction")
        print(f"[PostProcessor] Extracted misplaced 'nextAction' from settings")
    
    return extracted


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
        # CRITICAL: Trigger node must always have name="trigger"
        node["name"] = "trigger"
        
        # Normalize piece name
        if "pieceName" in settings:
            settings["pieceName"] = normalize_piece_name(settings["pieceName"])
        
        piece_name = settings.get("pieceName", "")
        
        # Normalize trigger name - static mappings first, smart matching as fallback
        if "triggerName" in settings:
            original_trigger = settings["triggerName"]
            # First try static mapping (high priority, known fixes)
            mapped_trigger = normalize_trigger_name(original_trigger)
            settings["triggerName"] = mapped_trigger
            
            # Smart matching ONLY as fallback when:
            # 1. Static mapping didn't change anything (no known fix)
            # 2. SmartMatcher is available
            # 3. We have a piece name to match against
            # SmartMatcher is conservative: won't change already-valid values
            if SMART_MATCHER_AVAILABLE and piece_name and mapped_trigger == original_trigger:
                settings["triggerName"] = smart_match_trigger(mapped_trigger, piece_name)
        
        trigger_name = settings.get("triggerName", "")
        
        # Handle pieces with no triggers (convert to webhook)
        PIECES_WITHOUT_TRIGGERS = {
            "@activepieces/piece-dropbox",
            "@activepieces/piece-box",
            "@activepieces/piece-microsoft-onedrive",
            "@activepieces/piece-http",  # HTTP piece has no triggers
            "@activepieces/piece-code",  # Code piece has no triggers
            "@activepieces/piece-delay", # Delay piece has no triggers
        }
        
        if piece_name in PIECES_WITHOUT_TRIGGERS:
            # Convert to webhook trigger
            original_piece = piece_name
            settings["pieceName"] = "@activepieces/piece-webhook"
            settings["triggerName"] = "catch_webhook"
            settings["pieceVersion"] = get_piece_version("@activepieces/piece-webhook")
            if "input" not in settings:
                settings["input"] = {}
            print(f"[PostProcessor] Converted {original_piece} trigger to webhook (piece has no triggers)")
            piece_name = settings["pieceName"]
        else:
            # Use TRIGGER_TO_PIECE_MAP to correct piece if trigger is on wrong piece
            if trigger_name in TRIGGER_TO_PIECE_MAP:
                correct_piece = TRIGGER_TO_PIECE_MAP[trigger_name]
                if piece_name != correct_piece and piece_name:
                    print(f"[PostProcessor] Fixed: trigger '{trigger_name}' moved from {piece_name} to {correct_piece}")
                    settings["pieceName"] = correct_piece
                    piece_name = correct_piece
            
            # Get pieceVersion from registry (AFTER potential piece correction)
            if not settings.get("pieceVersion") or not _is_valid_version(settings.get("pieceVersion", "")):
                settings["pieceVersion"] = get_piece_version(piece_name)
        
        # Ensure input and propertySettings
        if "input" not in settings:
            settings["input"] = {}
        if "propertySettings" not in settings:
            settings["propertySettings"] = {}
        
        # Pre-initialize authFields with type if auth is present in input
        # This prevents Activepieces from adding it without type during import
        if "auth" in settings.get("input", {}) and "authFields" not in settings["propertySettings"]:
            settings["propertySettings"]["authFields"] = {"type": "MANUAL"}
        
        # Ensure all propertySettings entries have required 'type' field
        settings["propertySettings"] = ensure_property_settings(settings["propertySettings"])
        
        # Extract any misplaced actions from settings and chain them properly
        misplaced_action = extract_misplaced_actions(settings)
        if misplaced_action:
            # Chain the misplaced action to the trigger's nextAction
            if node.get("nextAction"):
                # Append to end of existing chain
                current = node["nextAction"]
                while current.get("nextAction"):
                    current = current["nextAction"]
                current["nextAction"] = misplaced_action
            else:
                node["nextAction"] = misplaced_action
        
        node["settings"] = settings
    
    elif node_type == "PIECE":
        # Normalize piece name
        if "pieceName" in settings:
            settings["pieceName"] = normalize_piece_name(settings["pieceName"])
        
        piece_name = settings.get("pieceName", "")
        
        # Normalize action name - static mappings first, smart matching as fallback
        if "actionName" in settings:
            original_action = settings["actionName"]
            # First try static mapping (high priority, known fixes)
            mapped_action = normalize_action_name(original_action)
            settings["actionName"] = mapped_action
            
            # Smart matching ONLY as fallback when:
            # 1. Static mapping didn't change anything (no known fix)
            # 2. SmartMatcher is available
            # 3. We have a piece name to match against
            # SmartMatcher is conservative: won't change already-valid values
            if SMART_MATCHER_AVAILABLE and piece_name and mapped_action == original_action:
                settings["actionName"] = smart_match_action(mapped_action, piece_name)
        
        action_name = settings.get("actionName", "")
        
        # Use ACTION_TO_PIECE_MAP to correct piece if action is on wrong piece
        if action_name in ACTION_TO_PIECE_MAP:
            correct_piece = ACTION_TO_PIECE_MAP[action_name]
            if piece_name != correct_piece:
                print(f"[PostProcessor] Fixed: {action_name} moved from {piece_name} to {correct_piece}")
                settings["pieceName"] = correct_piece
                piece_name = correct_piece
        
        # Apply piece-specific action name corrections
        # (e.g., Linear uses linear_create_issue, not create_issue)
        if piece_name in PIECE_SPECIFIC_ACTION_FIXES:
            piece_fixes = PIECE_SPECIFIC_ACTION_FIXES[piece_name]
            if action_name in piece_fixes:
                correct_action = piece_fixes[action_name]
                print(f"[PostProcessor] Fixed: {action_name} → {correct_action} for {piece_name}")
                settings["actionName"] = correct_action
                action_name = correct_action
        
        # Get pieceVersion from registry (AFTER potential piece correction)
        if not settings.get("pieceVersion") or not _is_valid_version(settings.get("pieceVersion", "")):
            settings["pieceVersion"] = get_piece_version(piece_name)
        
        # Ensure input and propertySettings
        if "input" not in settings:
            settings["input"] = {}
        if "propertySettings" not in settings:
            settings["propertySettings"] = {}
        
        # Pre-initialize authFields with type if auth is present in input
        # This prevents Activepieces from adding it without type during import
        if "auth" in settings.get("input", {}) and "authFields" not in settings["propertySettings"]:
            settings["propertySettings"]["authFields"] = {"type": "MANUAL"}
        
        # Ensure all propertySettings entries have required 'type' field
        settings["propertySettings"] = ensure_property_settings(settings["propertySettings"])
        
        # Extract any misplaced actions from settings
        misplaced_action = extract_misplaced_actions(settings)
        if misplaced_action:
            if node.get("nextAction"):
                current = node["nextAction"]
                while current.get("nextAction"):
                    current = current["nextAction"]
                current["nextAction"] = misplaced_action
            else:
                node["nextAction"] = misplaced_action
        
        # Also check for actions nested inside input (model error)
        if isinstance(settings.get("input"), dict):
            input_misplaced = extract_misplaced_actions(settings["input"])
            if input_misplaced:
                if node.get("nextAction"):
                    current = node["nextAction"]
                    while current.get("nextAction"):
                        current = current["nextAction"]
                    current["nextAction"] = input_misplaced
                else:
                    node["nextAction"] = input_misplaced
        
        node["settings"] = settings
    
    elif node_type == "ROUTER" or node_type == "CONDITION":
        # Normalize CONDITION to ROUTER
        if node_type == "CONDITION":
            node["type"] = "ROUTER"
        
        # Ensure settings exists and is a dict
        if not settings or not isinstance(settings, dict):
            settings = {}
        
        # Ensure executionType
        if "executionType" not in settings:
            settings["executionType"] = "EXECUTE_FIRST_MATCH"
        
        # CRITICAL: ROUTER needs children array at node level, not nextAction in branches
        # This prevents the "Cannot read properties of undefined (reading 'map')" error
        
        # Initialize children as empty array if not present
        children = node.get("children")
        if children is None or not isinstance(children, list):
            children = []
        
        # Ensure branches exists as an array
        if "branches" not in settings or not isinstance(settings.get("branches"), list):
            settings["branches"] = []
        
        if settings["branches"]:
            new_branches = []
            for i, branch in enumerate(settings["branches"]):
                if not isinstance(branch, dict):
                    branch = {}
                
                # Normalize branch type
                branch_type = branch.get("branchType", "CONDITION")
                if branch_type == "CONDITION_BRANCH":
                    branch["branchType"] = "CONDITION"
                elif branch_type == "FALLBACK_BRANCH":
                    branch["branchType"] = "FALLBACK"
                elif branch_type == "CONDITION_BASED":
                    branch["branchType"] = "CONDITION"
                elif branch_type not in ("CONDITION", "FALLBACK"):
                    branch["branchType"] = "CONDITION"
                
                # Ensure branchName
                if "branchName" not in branch:
                    branch["branchName"] = f"Branch {i + 1}"
                
                # Ensure conditions array exists for CONDITION branches
                if branch.get("branchType") == "CONDITION" and "conditions" not in branch:
                    branch["conditions"] = [{"firstValue": "{{true}}", "operator": "EXISTS"}]
                
                # Extract nextAction from branch and add to children
                if "nextAction" in branch:
                    # Ensure children array is long enough
                    while len(children) <= i:
                        children.append(None)
                    children[i] = process_node(branch["nextAction"], step_counter)
                    del branch["nextAction"]
                
                new_branches.append(branch)
            
            settings["branches"] = new_branches
        
        # Ensure children array length matches branches length
        num_branches = len(settings.get("branches", []))
        while len(children) < num_branches:
            children.append(None)
        
        node["settings"] = settings
        node["children"] = children  # Always set, never undefined
        
        # Process any existing children
        if node["children"]:
            node["children"] = [
                process_node(child, step_counter) if child and isinstance(child, dict) else None 
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
            "pieceVersion": get_piece_version("@activepieces/piece-delay"),
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
    
    # Recurse through nextAction
    if node.get("nextAction"):
        extract_pieces(node["nextAction"], pieces)
    
    # Recurse through children (ROUTER)
    if "children" in node:
        for child in node.get("children", []):
            if child:
                extract_pieces(child, pieces)
    
    # Recurse through firstLoopAction (LOOP)
    if node.get("firstLoopAction"):
        extract_pieces(node["firstLoopAction"], pieces)
    
    # Also check branches for any nested nextActions (legacy format)
    if "branches" in settings:
        for branch in settings.get("branches", []):
            if branch and branch.get("nextAction"):
                extract_pieces(branch["nextAction"], pieces)
    
    return pieces


def sanitize_input(obj: Any) -> Any:
    """Remove invalid/problematic fields from workflow."""
    if isinstance(obj, dict):
        # Remove None values and empty strings for certain fields
        result = {}
        for k, v in obj.items():
            # Skip problematic fields
            if k in ("inputUiInfo", "sampleData", "errorHandlingOptions") and not v:
                continue
            # Recursively sanitize
            result[k] = sanitize_input(v)
        return result
    elif isinstance(obj, list):
        return [sanitize_input(item) for item in obj]
    return obj


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
        
        # Try to fix common JSON issues before parsing
        try:
            workflow = json.loads(workflow)
        except json.JSONDecodeError as e:
            # Try to repair truncated JSON by adding closing braces
            brace_count = workflow.count('{') - workflow.count('}')
            bracket_count = workflow.count('[') - workflow.count(']')
            if brace_count > 0 or bracket_count > 0:
                workflow = workflow + ']' * bracket_count + '}' * brace_count
                workflow = json.loads(workflow)
            else:
                raise e
    
    if not workflow:
        raise ValueError("Empty workflow")
    
    # Sanitize input
    workflow = sanitize_input(workflow)
    
    # Extract the actual workflow
    if "output" in workflow:
        output = workflow["output"]
    elif "template" in workflow and isinstance(workflow["template"], dict) and "trigger" in workflow["template"]:
        # Already wrapped in FlowTemplate format
        output = workflow["template"]
    else:
        output = workflow
    
    # Handle 'firstAction' instead of 'trigger' (convert to proper trigger)
    if "firstAction" in output and "trigger" not in output:
        first_action = output["firstAction"]
        # Check if first action is a webhook/trigger-like action
        piece_name = first_action.get("settings", {}).get("pieceName", "")
        action_type = first_action.get("type", "")
        
        if "webhook" in piece_name.lower() or action_type == "PIECE_TRIGGER":
            # Convert to trigger
            output["trigger"] = {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "valid": True,
                "displayName": first_action.get("displayName", "Webhook Trigger"),
                "settings": {
                    "pieceName": "@activepieces/piece-webhook",
                    "pieceVersion": get_piece_version("@activepieces/piece-webhook"),
                    "input": first_action.get("settings", {}).get("input", {}),
                    "propertySettings": {},
                    "triggerName": "catch_webhook"
                },
                "nextAction": first_action.get("nextAction")
            }
            del output["firstAction"]
        else:
            # Create a default webhook trigger and chain the firstAction
            print(f"[PostProcessor] No trigger found, creating webhook trigger for firstAction")
            output["trigger"] = {
                "name": "trigger",
                "type": "PIECE_TRIGGER",
                "valid": True,
                "displayName": "Webhook Trigger",
                "settings": {
                    "pieceName": "@activepieces/piece-webhook",
                    "pieceVersion": get_piece_version("@activepieces/piece-webhook"),
                    "input": {},
                    "propertySettings": {},
                    "triggerName": "catch_webhook"
                },
                "nextAction": first_action
            }
            del output["firstAction"]
    
    if "trigger" not in output:
        # Last resort: create an empty webhook trigger
        print(f"[PostProcessor] Warning: No trigger found, creating empty webhook trigger")
        output["trigger"] = {
            "name": "trigger",
            "type": "PIECE_TRIGGER",
            "valid": True,
            "displayName": "Webhook Trigger",
            "settings": {
                "pieceName": "@activepieces/piece-webhook",
                "pieceVersion": get_piece_version("@activepieces/piece-webhook"),
                "input": {},
                "propertySettings": {},
                "triggerName": "catch_webhook"
            }
        }
    
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
