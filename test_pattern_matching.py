#!/usr/bin/env python3
"""Test the robust pattern matching for trigger/action names."""

from robust_post_processor import NameMatcher

# Test cases: (model_output, expected_match, available_options)
test_cases = [
    # Gmail triggers
    ("new_email_received", "gmail_new_email_received", 
     ["gmail_new_email_received", "new_labeled_email"]),
    ("new_email", "gmail_new_email_received", 
     ["gmail_new_email_received", "new_labeled_email"]),
    ("newEmailReceived", "gmail_new_email_received", 
     ["gmail_new_email_received", "new_labeled_email"]),
    ("new-email-received", "gmail_new_email_received", 
     ["gmail_new_email_received", "new_labeled_email"]),
    
    # Google Sheets triggers
    ("new_row", "googlesheets_new_row_added", 
     ["googlesheets_new_row_added", "google-sheets-new-or-updated-row", "new-worksheet"]),
    ("newRow", "googlesheets_new_row_added", 
     ["googlesheets_new_row_added", "google-sheets-new-or-updated-row", "new-worksheet"]),
    ("new_row_added", "googlesheets_new_row_added", 
     ["googlesheets_new_row_added", "google-sheets-new-or-updated-row", "new-worksheet"]),
    ("newRowAdded", "googlesheets_new_row_added", 
     ["googlesheets_new_row_added", "google-sheets-new-or-updated-row", "new-worksheet"]),
    
    # Google Sheets actions
    ("insertRow", "insert_row", 
     ["insert_row", "update_row", "delete_row", "find_rows", "get-many-rows"]),
    ("insert-row", "insert_row", 
     ["insert_row", "update_row", "delete_row", "find_rows", "get-many-rows"]),
    ("addRow", "insert_row",  # Different verb
     ["insert_row", "update_row", "delete_row", "find_rows", "get-many-rows"]),
    
    # Slack actions
    ("sendMessage", "send_channel_message", 
     ["send_channel_message", "send_direct_message", "update-message"]),
    ("send_message", "send_channel_message", 
     ["send_channel_message", "send_direct_message", "update-message"]),
    ("sendChannelMessage", "send_channel_message", 
     ["send_channel_message", "send_direct_message", "update-message"]),
    
    # OpenAI actions
    ("askChatGpt", "ask_chatgpt", 
     ["ask_chatgpt", "text_to_speech", "transcribe_audio", "generate_image"]),
    ("ask_chat_gpt", "ask_chatgpt", 
     ["ask_chatgpt", "text_to_speech", "transcribe_audio", "generate_image"]),
    ("ask-chatgpt", "ask_chatgpt", 
     ["ask_chatgpt", "text_to_speech", "transcribe_audio", "generate_image"]),
    
    # Schedule triggers (these should already match)
    ("every_hour", "every_hour", 
     ["every_hour", "every_day", "every_week", "cron_expression"]),
    ("everyHour", "every_hour", 
     ["every_hour", "every_day", "every_week", "cron_expression"]),
    
    # Webhook triggers
    ("catch_request", "catch_webhook", 
     ["catch_webhook"]),
    ("webhook", "catch_webhook", 
     ["catch_webhook"]),
    ("catchWebhook", "catch_webhook", 
     ["catch_webhook"]),
    
    # More edge cases
    ("new_contact", "new-contact",
     ["new-contact", "contact_created", "updated-contact"]),
    ("newContact", "new-contact",
     ["new-contact", "contact_created", "updated-contact"]),
    ("createRow", "insert_row",
     ["insert_row", "update_row", "delete_row"]),
    ("appendRow", "insert_row",
     ["insert_row", "update_row", "delete_row"]),
    ("fetchRows", "find_rows",
     ["insert_row", "update_row", "delete_row", "find_rows"]),
    ("getRows", "find_rows",
     ["insert_row", "update_row", "delete_row", "find_rows"]),
    ("retrieveRows", "find_rows",
     ["insert_row", "update_row", "delete_row", "find_rows"]),
    ("removeRow", "delete_row",
     ["insert_row", "update_row", "delete_row", "find_rows"]),
    ("postMessage", "send_channel_message",
     ["send_channel_message", "send_direct_message"]),
    ("submitMessage", "send_channel_message",
     ["send_channel_message", "send_direct_message"]),
    ("incomingWebhook", "catch_webhook",
     ["catch_webhook"]),
    ("handleWebhook", "catch_webhook",
     ["catch_webhook"]),
    
    # Ambiguous but should prefer "channel" over "direct" when not specified
    ("slack_send_message", "send_channel_message",
     ["send_channel_message", "send_direct_message"]),
     
    # New forms cases
    ("formSubmission", "form_submission",
     ["form_submission", "chat_completion"]),
    ("newFormSubmission", "form_submission",
     ["form_submission", "chat_completion"]),
]

print("=" * 80)
print("Testing Robust Pattern Matching")
print("=" * 80)
print()

passed = 0
failed = 0

for model_output, expected, candidates in test_cases:
    result = NameMatcher.find_best_match(model_output, candidates, threshold=0.5)
    
    if result:
        match, score = result
        status = "✅" if match == expected else "❌"
        if match == expected:
            passed += 1
        else:
            failed += 1
        print(f"{status} '{model_output}' → '{match}' (score: {score:.2f})")
        if match != expected:
            print(f"   Expected: '{expected}'")
    else:
        failed += 1
        print(f"❌ '{model_output}' → NO MATCH (expected: '{expected}')")

print()
print("=" * 80)
print(f"Results: {passed} passed, {failed} failed")
print("=" * 80)

# Show detailed similarity scores for a problematic case if any failed
if failed > 0:
    print("\nDetailed analysis of failed cases:")
    for model_output, expected, candidates in test_cases:
        result = NameMatcher.find_best_match(model_output, candidates, threshold=0.5)
        if result:
            match, score = result
            if match != expected:
                print(f"\n'{model_output}' → '{match}' but expected '{expected}'")
                print("Scores for all candidates:")
                for candidate in candidates:
                    s = NameMatcher.similarity_score(model_output, candidate)
                    print(f"  {candidate}: {s:.3f}")
        else:
            print(f"\n'{model_output}' → NO MATCH, expected '{expected}'")
            print("Scores for all candidates:")
            for candidate in candidates:
                s = NameMatcher.similarity_score(model_output, candidate)
                print(f"  {candidate}: {s:.3f}")

