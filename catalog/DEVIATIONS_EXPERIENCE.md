# Deviations experience design

This document describes how the three **deviation types** and three **entry points** work together so sellers can add or request deviations consistently whether they are building a quote, in the Deviations tab, or in Deal margin.

---

## 1. Three deviation types

| Type | Description | Single vs multi-quote | Affects quote config? | Affects deal margin? |
|------|-------------|------------------------|------------------------|----------------------|
| **Quote configuration** | Customize term length, billing frequency, burst value, or other quote-level settings. If the value differs from standard, it’s a deviation. | User chooses: **single quote** or **multiple quotes** (under one opportunity). | Yes — reflected in the quote. | No (unless the config itself impacts margin). |
| **Deal margin impact** | Customizations that change how deal margin is calculated (e.g. 3 months free, 1 month free). | Typically tied to the deal/quote(s) in context. | May affect quote (e.g. free months). | **Yes** — margin calculation reflects the deviation. |
| **Legal language only** | Add specific legal or compliance language to the quote. No configuration or pricing changes. | User can apply to single or multi-quote. | No. | No. |

---

## 2. Three entry points

Sellers can add or request deviations from:

1. **While generating a quote** (Sizing / Create a quote)
2. **In the Deviations tab** (Apply deviation step — standalone)
3. **At the time of deal margin** (Deal approval → Deal margin → Deviations tab)

---

## 3. How it looks in each place

### 3.1 Within the quote (Sizing page)

**Where:** After “Quote options” (or in the right sidebar), a **Deviations** section.

**Experience:**

- **Heading:** “Deviations for this quote” (or “Add deviation”).
- **Short explanation:** “Add configuration, margin-impact, or legal-only deviations for Quote 123. You can select an existing approved deviation or request a new one.”
- **Primary action:** “Add deviation” button.
- **On click:** A **compact panel or modal** with:
  1. **Step 1 — Type:** Three options (cards or radio):
     - **Quote configuration** — “Term, billing frequency, burst, etc. Apply to this quote only or to multiple quotes.”
     - **Deal margin impact** — “e.g. 3 months free. This will affect how deal margin is calculated.”
     - **Legal language only** — “Add legal/compliance language to the quote. No config or pricing changes.”
  2. **Step 2 — Select or request:**
     - **Select existing:** Dropdown of approved deviations of that type; optional “Apply to” (this quote only / add more quote IDs). Submit.
     - **Request new:** Short form (type pre-selected, opportunity/quote pre-filled from current context); submit request.
- **List:** Any deviations already applied to this quote appear above the button (type badge + name + status).

**Result:** Same three types and same “select vs request” logic as the Deviations tab, but with **quote and opportunity context pre-filled** and a lighter UI so the seller stays in the quoting flow.

---

### 3.2 In the Deviations tab (standalone)

**Where:** Apply deviation step — full Deviations page.

**Experience:**

- **Page title:** “Deviations”
- **Intro:** “Select or request deviations. Choose the type first, then select an existing deviation or submit a new request.”
- **Step 1 — Deviation type (new first step):**
  - Three cards:
    1. **Quote configuration** — “Customize term length, billing frequency, burst value, etc. Apply to single or multiple quotes.”
    2. **Deal margin impact** — “e.g. 3 months free, 1 month free. Affects how deal margin is calculated.”
    3. **Legal language only** — “Add legal language to the quote. No configuration or pricing changes.”
  - User picks one; the rest of the page adapts to that type.
- **Step 2 — What would you like to do?**
  - **Select existing deviation** — Dropdown filtered by type (config / margin impact / legal). Opportunity ID + Quote ID(s) (single or multi). Requester, comment, submit.
  - **Request new deviation** — Full intake form (deal info, requestor, deviation type pre-selected, documents). For **legal only**, the form can hide deal-economics fields and emphasize “Legal language description” and attachments.
- **Type-specific details:**
  - **Quote configuration:** Show “Apply to” (single quote / multiple quotes) and quote IDs; dropdown options like “Burst to 80%”, “Custom term length”, “Custom billing frequency”.
  - **Deal margin impact:** Dropdown options like “Three months free”, “One month free”; note: “This deviation will be reflected in deal margin calculations.”
  - **Legal language only:** Dropdown or text for “Legal clause” name; optional description/attachments; no pricing or term fields.

**Result:** One place to do any deviation type without a quote on screen; user manually enters opportunity and quote IDs (or we pass them via URL/state when coming from quote or deal margin).

---

### 3.3 At the time of deal margin (Deal approval → Deal margin → Deviations tab)

**Where:** Deal margin page → **Deviations** tab.

**Experience:**

- **Tab content:**
  1. **Summary of deviations affecting this deal**  
     List of deviations already applied to the current quote/deal, with **type badges**:
     - `Configuration` — e.g. “Burst 80%”, “Custom term”
     - `Margin impact` — e.g. “3 months free” (with short note: “Included in margin calculation”)
     - `Legal` — e.g. “Custom SLA terms”
  2. **Recommended next steps** (existing) — Based on margin and deviations.
  3. **Request a deviation**  
     Button: “Request deviation”.  
     On click: **same flow as Deviations tab**, but:
     - **Context pre-filled:** Opportunity ID, Quote ID(s) from the current deal.
     - **Default or prominent type:** “Deal margin impact” (e.g. 3 months free, 1 month free) since the user is in the margin view; they can still switch to Configuration or Legal.
   - Optional: inline short form “Quick request: Deal margin impact” (dropdown + comment) that creates a request and links to the full Deviations page for status.

**Result:** Sellers see how deviations (especially margin-impact) tie to the deal margin; they can request new ones (especially margin-impact) without leaving the deal context.

---

## 4. Summary matrix

| Entry point        | Quote configuration        | Deal margin impact              | Legal language only        |
|--------------------|----------------------------|----------------------------------|----------------------------|
| **Within quote**   | Add/select in modal; single/multi-quote; config options. | Add/select in modal; note that it affects margin. | Add/select in modal; legal only. |
| **Deviations tab** | Choose type → select existing or request new; opportunity + quote IDs; config dropdown. | Same; margin-impact dropdown; note “affects margin calculation”. | Same; legal dropdown/description; no pricing. |
| **Deal margin**    | List + “Request deviation” (opens full flow with context). | List with “affects margin” + default type when requesting. | List + request with context. |

---

## 5. Implementation notes

- **Shared data:** Deviation type (config / margin_impact / legal), scope (single/multi-quote), and optional “affects_margin” flag so the Deal margin tab can filter and label correctly.
- **URL/query params:** When opening the Deviations page from Sizing or Deal margin, pass `?opportunity=...&quote=...` (and optionally `type=margin_impact`) to pre-fill and focus the form.
- **Dropdowns:** In “Select existing,” options can be filtered by type; in “Request new,” the intake form sections (deal info vs legal-only) can show/hide by type.
