import { hasBlockingAttention, label, type ChangeImpact } from "./api";
import { journeyLabel, useJourneyCopy } from "./journeyCopy";

const consequences: Record<string, string> = {
  PRESERVE: "Keep the current arrangement",
  WITHDRAW_AND_REQUIRE_NEW_PROPOSAL: "Withdraw the proposal; a new proposal is needed for revised terms",
  CANCEL_FIXTURE_KEEP_HISTORY: "Cancel the fixture and keep the opponent in its history",
  REOPEN_REQUIRE_NEW_AGREEMENT: "Reopen the listing; the opponent must agree again through a new proposal",
  CANCEL_REQUIRE_NEW_INVITATION: "Cancel the appointment; invite the official again for revised terms",
  CLOSE_PRESERVE_STORED_HISTORY: "Close the conversation; its stored history is retained",
  PRESERVE_REFERENCE_AND_BOOKING: "Keep this reservation and its link to the match",
  PRESERVE_UNTIL_HOST_RESOLVES: "Keep the confirmation until the host resolves the arrangement",
  PRESERVE_EXTERNAL_EVIDENCE: "Keep the original ground confirmation in history; record the host's follow-up separately",
};
const georgianConsequences: Record<string,string> = {
  PRESERVE: "მიმდინარე შეთანხმების შენარჩუნება",
  WITHDRAW_AND_REQUIRE_NEW_PROPOSAL: "შეთავაზების გაუქმება; შეცვლილი პირობებისთვის საჭიროა ახალი შეთავაზება",
  CANCEL_FIXTURE_KEEP_HISTORY: "მატჩის გაუქმება და მეტოქის ისტორიაში შენარჩუნება",
  REOPEN_REQUIRE_NEW_AGREEMENT: "განაცხადის ხელახლა გახსნა; მეტოქემ ახალი შეთავაზებით უნდა დაადასტუროს თანხმობა",
  CANCEL_REQUIRE_NEW_INVITATION: "დანიშვნის გაუქმება; შეცვლილი პირობებისთვის საჭიროა მსაჯის ახალი მოწვევა",
  CLOSE_PRESERVE_STORED_HISTORY: "საუბრის დახურვა და შენახული ისტორიის შენარჩუნება",
  PRESERVE_REFERENCE_AND_BOOKING: "ჯავშნისა და მატჩთან მისი კავშირის შენარჩუნება",
  PRESERVE_UNTIL_HOST_RESOLVES: "დადასტურების შენარჩუნება მასპინძლის მიერ საკითხის მოგვარებამდე",
  PRESERVE_EXTERNAL_EVIDENCE: "მოედნის თავდაპირველი დადასტურების ისტორიაში შენარჩუნება; მასპინძლის შემდგომი მოქმედება ცალკე ფიქსირდება",
};

export function MatchChangeImpact({ impact }: { impact: ChangeImpact }) {
  const { copy, language } = useJourneyCopy();
  const blocked = hasBlockingAttention(impact);
  return (
    <div className="mx-notice" role="status">
      <h3>{copy(blocked ? "resolveFirst" : "reviewImpact")}</h3>
      {impact.needsAttention.map((item) => <p key={item.code}>{language !== "ka" ? item.message
        : item.code === "CANCELLATION_REASON_REQUIRED" ? copy("cancelReason")
        : item.code === "RESOLVE_VENUE_BOOKING" ? copy(impact.action === "CANCEL" ? "bookingFollowup" : "bookingBeforeEdit")
        : item.code === "RESOLVE_EXTERNAL_VENUE" ? copy(impact.action === "CANCEL" ? "externalFollowup" : "externalBeforeEdit") : item.message}</p>)}
      <ul>
        {impact.dependencies.map((item, index) => (
          <li key={`${item.domain}-${item.id}-${index}`}>
            {journeyLabel(item.domain, language)}{item.id != null ? ` #${item.id}` : ""} ({journeyLabel(item.state, language)}): {(language === "ka" ? georgianConsequences : consequences)[item.consequence] || label(item.consequence)}.
          </li>
        ))}
      </ul>
      <p>{copy("unchanged")} {copy(blocked ? "resolveReload" : "confirmImpact")}</p>
    </div>
  );
}
