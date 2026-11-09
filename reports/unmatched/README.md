# Unmatched reference submissions

Each successful **Report unmatched** submission creates a `report-<timestamp>-<uuid>.txt` file here.

[**ALL_UNMATCHED.txt**](./ALL_UNMATCHED.txt) is a human-readable, consolidated list that can be copied into ChatGPT. It groups repeated unmatched names by unit and shows how many reports mention them. Once a missing reference is verified and added to the reviewed source catalogue, the combined list excludes it from the current unresolved queue and records how many archived occurrences were resolved. Original submitted text files are retained unchanged.

The files are public because the repository is public. The reporting form warns users and only submits names of unmatched units or options, parent unit names, source lines, format, an optional faction, and `tow.whfb.app` unit links. It does not send player names or complete armies.

Reports are not rules verification and do not establish army legality.

Users **do not need GitHub accounts**. A Cloudflare Worker, protected by Turnstile, sends reports using credentials available only to the Worker. The repository owner deployed and enabled the Worker on 9 November 2026. Private credentials remain outside this repository.
