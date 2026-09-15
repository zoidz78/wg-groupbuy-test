# Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Tracks whether each member has paid for a given group buy event.
    // Doc ID = group buy date (e.g. "2026-09-07"). Open read/write so the
    // dashboard can sync payment status in real time for all viewers.
    match /paidStatus/{groupBuyDate} {
      allow read, write: if true;
    }

    // Stores order adjustments (quantity/amount deltas, weight notes, etc.)
    // for a given group buy event. Doc ID = group buy date.
    match /adjustments/{groupBuyDate} {
      allow read, write: if true;
    }

    // Tracks whether each member's order has been physically packed for a
    // given group buy event — separate from paidStatus (packing and payment
    // are independent). Doc ID = group buy date.
    match /packedStatus/{groupBuyDate} {
      allow read, write: if true;
    }

    // Per-item-line sorting checkbox ("I've physically pulled this item"),
    // for a given group buy event — a finer-grained cousin of packedStatus
    // (per member+item instead of just per member). Keys within the doc
    // look like "memberName::itemKey". Doc ID = group buy date.
    match /sortedItems/{groupBuyDate} {
      allow read, write: if true;
    }

    // Stores member profile/reference info (e.g. display name mappings).
    // Doc ID = member/document identifier.
    match /memberInfo/{docId} {
      allow read, write: if true;
    }
  }
}
```
