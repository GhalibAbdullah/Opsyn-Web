// Quick analysis of model outputs
const outputs = [
  {
    name: "Output 1: Webhook → Conditional Slack/Sheets",
    issues: [
      "❌ Missing ROUTER for conditional logic (if email missing)",
      "❌ triggerName at wrong level (should be in settings.triggerName)",
      "❌ Missing propertySettings in settings",
      "❌ Missing pieceVersion in settings",
      "❌ Has inputUiInfo (should be removed)",
      "❌ Has pieceType (should be removed)",
      "❌ Wrong trigger name: 'new_webhook_received' should be 'webhook' or 'catch_webhook'",
      "❌ Missing Google Sheets action entirely",
      "❌ Hardcoded channel ID instead of '#ops'"
    ],
    salvageable: "Partially - structure is close but missing conditional logic"
  },
  {
    name: "Output 2: Webhook → HubSpot → Slack",
    issues: [
      "❌ triggerName at wrong level",
      "❌ Missing propertySettings and pieceVersion",
      "❌ Has inputUiInfo and pieceType",
      "❌ Wrong trigger name: 'create-contact' is an ACTION name, not trigger",
      "❌ Missing Slack notification step entirely",
      "❌ Wrong action name: 'triggerName' should be 'actionName'"
    ],
    salvageable: "Partially - has HubSpot but missing Slack step"
  },
  {
    name: "Output 3: Notion → Slack",
    issues: [
      "❌ triggerName at wrong level",
      "❌ Missing propertySettings and pieceVersion",
      "❌ Has inputUiInfo and pieceType",
      "❌ Hardcoded channel ID",
      "❌ Wrong expression syntax in text field"
    ],
    salvageable: "Yes - structure is mostly correct, just needs cleanup"
  },
  {
    name: "Output 4: Sheets → Conditional Email/Slack",
    issues: [
      "❌ Missing ROUTER for conditional logic (if leadScore >= 80)",
      "❌ triggerName at wrong level",
      "❌ Missing propertySettings and pieceVersion",
      "❌ Has inputUiInfo and pieceType",
      "❌ Missing Slack action entirely",
      "❌ Wrong trigger name format"
    ],
    salvageable: "Partially - has Sheets and Email but missing conditional and Slack"
  }
];

console.log("=".repeat(70));
console.log("MODEL OUTPUT ANALYSIS");
console.log("=".repeat(70));
console.log("");

outputs.forEach((output, i) => {
  console.log(`${i + 1}. ${output.name}`);
  console.log("-".repeat(70));
  output.issues.forEach(issue => console.log(`   ${issue}`));
  console.log(`\n   Salvageable: ${output.salvageable}`);
  console.log("");
});

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log("");
console.log("Common Issues Across All Outputs:");
console.log("  1. ❌ triggerName at wrong level (should be in settings.triggerName)");
console.log("  2. ❌ Missing propertySettings in settings");
console.log("  3. ❌ Missing pieceVersion in settings");
console.log("  4. ❌ Has inputUiInfo and pieceType (UI-only fields)");
console.log("  5. ❌ Missing conditional logic (ROUTER) when requested");
console.log("  6. ❌ Missing steps entirely (Slack, Sheets, etc.)");
console.log("");
console.log("Recommendation:");
console.log("  ✅ YES - Outputs are salvageable with post-processor");
console.log("  ⚠️  BUT - Model needs better training on:");
console.log("     - Conditional logic (ROUTER actions)");
console.log("     - Complete workflows (not missing steps)");
console.log("     - Correct schema structure");
console.log("");

