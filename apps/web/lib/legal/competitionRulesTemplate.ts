// The CPA-compliant "Master Campaign Competition-Rules Template" (see
// docs/legal/COMPETITION_RULES.md Part B). Seeding a new legal document from
// this makes every affiliate competition compliant with the Consumer Protection
// Act 2008 §36 / Regulation 11 by default — the admin then only fills the
// [bracketed] placeholders in the Legal-docs editor (the single source of truth)
// and binds the published document to the campaign on its Rules tab.
//
// Kept as one exported constant so both the editor's "start from template" and
// any future seed reference the exact same wording.

export const COMPETITION_RULES_TEMPLATE_HTML = `<p><em>Fill every [bracketed] placeholder, then publish. Every clause below maps to a CPA §36 / Reg 11 requirement, so a competition published from this template is compliant by design. Delete this note before publishing.</em></p>
<p><strong>Promoter:</strong> Wielo Platform (Pty) Ltd, [registration no.], [registered address], legal@wielo.co.za<br />
<strong>Competition:</strong> [Campaign name]<br />
<strong>Retained URL:</strong> /legal/[campaign-slug]-rules<br />
<strong>Version / last updated:</strong> [stamped on publish]</p>
<ol>
<li><strong>How to enter.</strong> [Exact entry mechanic — e.g. join the affiliate programme and generate referrals through your competition link.] Entry is free; no purchase is a condition of entry.</li>
<li><strong>Who may enter.</strong> Open to natural persons who are [18] or older and resident in [South Africa]. Directors, members, partners, employees, agents and consultants of the promoter (and their immediate families) and anyone involved in running the competition may not enter or win.</li>
<li><strong>Competition period.</strong> Opens [date/time] and closes [date/time] (South African time). Qualifying activity after the closing time does not count.</li>
<li><strong>How winners are determined.</strong> [Scoring / leaderboard / prize rules — e.g. one point per active published listing from your referrals, ranked on the public leaderboard.] Platform-recorded scores are determinative.</li>
<li><strong>Prizes.</strong> [Full description and Rand value of each prize; total prize pot; how ties are broken.] Prizes are not transferable or exchangeable for cash unless the promoter states otherwise.</li>
<li><strong>Notification &amp; claiming.</strong> Winners are notified by [email / in-app] within [period] of the closing date and must claim within [period]. Unclaimed prizes may be forfeited and re-awarded.</li>
<li><strong>Publication of results.</strong> The promoter may publish winners&rsquo; display names and provinces, and winners consent to reasonable announcement of results.</li>
<li><strong>Tax.</strong> [State who bears any tax on the prize.]</li>
<li><strong>Payment of prizes.</strong> Monetary prizes are paid to the winner&rsquo;s verified payout account within [period] of a valid claim.</li>
<li><strong>Disqualification.</strong> The promoter may disqualify any entrant who breaches these rules, the Affiliate Program Terms or the Terms of Service, or who engages in fraud or abuse.</li>
<li><strong>Liability.</strong> To the extent permitted by law, the promoter is not liable for loss arising from participation or a prize, except where it cannot lawfully be excluded.</li>
<li><strong>Availability of rules.</strong> These rules are available free of charge at the retained URL above for at least three years and on request from legal@wielo.co.za.</li>
<li><strong>Governing law.</strong> The laws of the Republic of South Africa. The promoter&rsquo;s decisions on the conduct of the competition are final.</li>
</ol>`;
