# Unmatched reference submissions

Each successful **Report unmatched** submission creates a `report-<timestamp>-<uuid>.txt` file here.

[**ALL_UNMATCHED.txt**](./ALL_UNMATCHED.txt) is a human-readable, consolidated list that can be copied into ChatGPT. It groups repeated unmatched names by unit and shows how many reports mention them.

The files are public because the repository is public. The reporting form warns users and only submits names of unmatched units or options, parent unit names, source lines, format, an optional faction, and `tow.whfb.app` unit links. It does not send player names or complete armies.

Reports are not rules verification and do not establish army legality.

Users **do not need GitHub accounts**. A Cloudflare Worker, protected by Turnstile, sends reports using credentials available only to the Worker. The repository owner must configure and deploy that Worker. The website disables reporting until configured.
