#!/usr/bin/env python3
"""Independent factual JSON export of published Warhammer: The Old World army/unit pages.

The source is exclusively https://tow.whfb.app public HTML and its embedded
pageProps.entry.fields. This does NOT mirror the nested linked rules' descriptions.
Keep this self-contained and separate from the Game Manager application.
"""
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.robotparser
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Tag

ROOT="https://tow.whfb.app"
SITEMAP=ROOT+"/sitemap/armies"
UA="IndependentOldWorldReferenceExport/0.1 (private research, source-linked)"
OUTPUT=Path("scratch-output")
PILOT=int(os.getenv("PILOT_COUNT","0"))
DELAY=float(os.getenv("SOURCE_DELAY_SECONDS","0.85"))
TIMEOUT=28
COLUMNS=["M","WS","BS","S","T","W","I","A","Ld"]
SESSION=requests.Session()
SESSION.headers.update({"User-Agent":UA,"Accept":"text/html,application/xhtml+xml"})
checked_at=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
def clean(text):
    return " ".join(str(text or "").split())
def safe(href,kind=None):
    try:
        p=urllib.parse.urlparse(urllib.parse.urljoin(ROOT,href))
        if p.scheme!="https" or p.netloc!="tow.whfb.app" or p.query or p.fragment:return None
        if not re.fullmatch(r"/(?:unit|army)/[a-z0-9-]+/?",p.path):return None
        if kind and p.path.split('/')[1]!=kind:return None
        return ROOT+p.path.rstrip('/')
    except Exception:return None
def link(href):
    try:
        p=urllib.parse.urlparse(urllib.parse.urljoin(ROOT,href))
        if p.scheme!="https" or p.netloc!="tow.whfb.app" or p.query or p.fragment:return None
        if not re.fullmatch(r"/[a-z0-9-]+(?:/[a-z0-9-]+)?/?",p.path):return None
        return ROOT+p.path.rstrip('/')
    except Exception:return None

def fetch(url):
    for attempt in range(3):
        try:
            r=SESSION.get(url,timeout=TIMEOUT,allow_redirects=False)
            if r.status_code in (429,401,403):
                raise RuntimeError(f"Upstream blocked or rate-limited access: {r.status_code} {url}")
            if 300<=r.status_code<400:
                raise RuntimeError(f"Unexpected redirect {r.status_code} {url}")
            if r.status_code>=500:
                if attempt<2:time.sleep(2*(attempt+1));continue
                raise RuntimeError(f"Upstream server error {r.status_code}: {url}")
            r.raise_for_status()
            if len(r.content)>2_000_000:raise ValueError("Source HTML exceeds 2MB: "+url)
            if "html" not in r.headers.get("content-type","").lower():
                raise ValueError("Non-HTML response: "+url)
            return r.text
        except (requests.Timeout,requests.ConnectionError) as error:
            if attempt==2:raise
            time.sleep(2*(attempt+1))
    raise RuntimeError("Fetch failed "+url)

def check_robots():
    robots=ROOT+"/robots.txt"
    try:r=SESSION.get(robots,timeout=TIMEOUT)
    except requests.RequestException as e:raise RuntimeError("Cannot confirm source crawl permissions") from e
    if r.status_code in (401,403,429) or r.status_code>=500:
        raise RuntimeError("Robots access disallowed/unavailable HTTP "+str(r.status_code))
    if r.status_code==200:
        parser=urllib.robotparser.RobotFileParser()
        parser.parse(r.text.splitlines())
        for path in ("/sitemap/armies","/unit/lothern-sea-guard","/army/high-elf-realms"):
            if not parser.can_fetch(UA,ROOT+path):
                raise RuntimeError("Robots disallows "+path)
        print("robots: allowed public army and unit HTML; excluded paths are never requested",flush=True)
    elif r.status_code==404:
        print("robots: no file (404), no published robots restrictions found",flush=True)
    else:raise RuntimeError("Unexpected robots HTTP "+str(r.status_code))
def entries_from_sitemap(html):
    soup=BeautifulSoup(html,"lxml")
    result=[];seen=set()
    for label,kind in (("Army Index","army"),("Unit Index","unit")):
        h=next((h for h in soup.select("h1,h2,h3,h4") if clean(h.get_text(' ',strip=True))==label),None)
        if not h:raise ValueError("Missing "+label)
        for sib in h.next_siblings:
            if isinstance(sib,Tag) and sib.name in ("h1","h2","h3","h4"):break
            if not isinstance(sib,Tag):continue
            anchors=[sib] if sib.name=='a' else sib.select("a[href]")
            for a in anchors:
                url=safe(a.get("href",""),kind);name=clean(a.get_text(' ',strip=True))
                if url and name and url not in seen:
                    result.append({"id":kind+":"+url.rsplit('/',1)[-1],"name":name,"sourceUrl":url,"kind":kind})
                    seen.add(url)
    na=sum(x["kind"]=="army" for x in result)
    nu=sum(x["kind"]=="unit" for x in result)
    if not 15<=na<=100 or not 500<=nu<=1500:raise ValueError(f"Incomplete sitemap: {na} armies, {nu} units")
    return result

def next_entry(html):
    soup=BeautifulSoup(html,"lxml")
    for scr in soup.select("script"):
        raw=scr.string or scr.get_text()
        if not raw or '"pageProps"' not in raw[:2500]:continue
        try:p=json.loads(raw)
        except json.JSONDecodeError:continue
        e=p.get("props",{}).get("pageProps",{}).get("entry")
        if isinstance(e,dict) and isinstance(e.get("fields"),dict):
            return soup,e
    raise ValueError("No valid structured pageProps.entry in public HTML")
def ref_a(a):
    url=link(a.get("href",""));name=clean(a.get_text(' ',strip=True))
    if not url or not name:return None
    return {"name":name,"sourceUrl":url,"kind":urllib.parse.urlparse(url).path.split('/')[1]}
def list_refs(section):
    if section is None:return []
    seen=set();result=[]
    for a in section.select("a[href]"):
        r=ref_a(a)
        if r and r["sourceUrl"] not in seen:
            seen.add(r["sourceUrl"]);result.append(r)
    return result
def model_stats(raw):
    if not isinstance(raw,dict):return None
    name=clean(raw.get("Name") or raw.get("name"))
    if not name:return None
    stats={}
    for x in COLUMNS:
        v=raw.get(x)
        stats[x]=int(v) if isinstance(v,str) and re.fullmatch(r"\d+",v) else v
    return {"name":name,"characteristics":stats}
def source_field(soup,key,prefix=None):
    node=soup.select_one(".unit-profile__details--"+key)
    if not node:return None
    t=clean(node.get_text(' ',strip=True))
    if prefix:t=re.sub(r"^"+re.escape(prefix)+r"\s*:\s*","",t,flags=re.I)
    return t or None
def option_refs(elem):
    return list_refs(elem)
def own_text(elem):
    # Only a direct paragraph; never conflate an eligibility parent with its children.
    p=next((p for p in elem.find_all("p",recursive=False)),None)
    if p:return clean(p.get_text(' ',strip=True))
    return clean(" ".join(str(x) for x in elem.find_all(string=True,recursive=False)))
def cost_info(text):
    mt=re.search(r"\(\s*\+(\d[\d,]*)\s+points?\s+per\s+(model|unit)\s*\)",text,re.I)
    if mt:return {"amount":int(mt.group(1).replace(",","")),"basis":"per_"+mt.group(2).lower(),"sourceText":mt.group(0)}
    mt=re.search(r"\(\s*\+(\d[\d,]*)\s+points?\s*\)",text,re.I)
    if mt:return {"amount":int(mt.group(1).replace(",","")),"basis":"unspecified","sourceText":mt.group(0)}
    return None
def cap_info(text):
    mt=re.search(r"(?:up to a total of|worth up to)\s+(\d[\d,]*)\s+points",text,re.I)
    return int(mt.group(1).replace(",","")) if mt else None
def describe_options(soup):
    node=soup.select_one(".unit-profile__details--option")
    if not node:return []
    root=node.find("ul",recursive=False)
    if not root:return []
    groups=[]
    for n,li in enumerate(root.find_all("li",recursive=False)):
        sub=li.find("ul",recursive=False)
        header=own_text(li)
        entries=sub.find_all("li",recursive=False) if sub else [li]
        options=[]
        for k,entry in enumerate(entries):
            text=own_text(entry)
            if not text:continue
            opt={"id":"option:"+str(n+1)+":"+str(k+1),"description":text,
                 "points":cost_info(text),"magicItemPointsCap":cap_info(text),
                 "linkedReferences":option_refs(entry),"status":"source-extracted-unverified"}
            options.append(opt)
        if options:
            groups.append({"id":"group:"+str(n+1),
                "eligibilityClause":header if sub else None,
                "relationship":"not_asserted_mutually_exclusive",
                "options":options})
    return groups

def get_source_metadata(soup,entry):
    sys=entry.get("sys",{})
    pub=soup.select_one("li.page-reference")
    book=clean(pub.get_text(' ',strip=True)) if pub else None
    upd=soup.select_one("li.update-timestamp")
    updated=clean(upd.get_text(' ',strip=True)) if upd else None
    return {"sourceUrl":None,"checkedAt":checked_at,
        "entryId":sys.get("id"),
        "sourceUpdatedAt":sys.get("updatedAt"),"sourceRevision":sys.get("revision"),
        "publishedVersion":sys.get("publishedVersion"),
        "displayedUpdatedAt":updated,"publicationCitation":book,
        "verificationStatus":"source-extracted",
        "sourceVersion":None,
        "method":"public HTML embedded structured pageProps; verified link location and DOM option hierarchy"}

def refs_from_contentful(fields,key):
    values=fields.get(key) or []
    if not isinstance(values,list):return []
    out=[]
    for r in values:
        if not isinstance(r,dict):continue
        rf=r.get("fields") or {};sys=r.get("sys") or {}
        name=clean(rf.get("name") or rf.get("title"))
        if not name:continue
        out.append({"name":name,"sourceEntryId":sys.get("id"),"sourceEntryType":((sys.get("contentType") or {}).get("sys") or {}).get("id")})
    return out

def extract_unit(html,url,expected_name):
    soup,e=next_entry(html)
    fs=e["fields"];path=urllib.parse.urlparse(url).path
    slug=path.split("/")[-1]
    name=clean(fs.get("name"))
    if not name:raise ValueError("No structured source unit name")
    sitemap_name_diff=clean(expected_name).casefold()!=name.casefold()
    profiles=[model_stats(r) for r in fs.get("unitProfile",[]) if isinstance(r,dict)]
    profiles=[p for p in profiles if p]
    if not profiles:raise ValueError("Missing source structured characteristic profiles")
    costText=source_field(soup,"points","Cost")
    meta=get_source_metadata(soup,e)
    meta["sourceUrl"]=url
    meta["htmlSha256"]=hashlib.sha256(html.encode("utf-8")).hexdigest()
    unit_category=refs_from_contentful(fs,"unitCategory")
    troop_type=refs_from_contentful(fs,"troopType")
    base_size=fs.get("baseSize")
    base_mm=None
    if isinstance(base_size,str):
        m=re.match(r"^(\d+)\s*[x×]\s*(\d+)\s*mm$",base_size,re.I)
        if m:base_mm={"width":int(m.group(1)),"depth":int(m.group(2))}
    c=fs.get("cost")
    m=re.search(r"\+?\d[\d,]*",str(c)) if c is not None else None
    if m is None and costText:
        m=re.search(r"\+?\d[\d,]*",costText)
    am=int(m.group(0).lstrip("+").replace(",","")) if m else None
    is_additive=bool(costText and costText.strip().startswith("+"))
    basis=("per_model" if costText and "per model" in costText.lower()
        else "additional_cost" if is_additive else "per_unit")
    options=describe_options(soup)
    equipment=list_refs(soup.select_one(".unit-profile__details--equipment"))
    default_rules=list_refs(soup.select_one(".unit-profile__details--special-rules"))
    optional_rules=list_refs(soup.select_one(".unit-profile__details--optional-rules"))
    # Source model data may include additional narrative and conditional fields;
    # preserve their names so the review knows when something remains unparsed.
    known={"name","slug","pageReference","unitProfile","cost","baseSize","unitSize",
        "equipment","specialRules","options","optionalRules","troopType",
        "unitCategory","association","armyLists","nameSingular"}
    extra={k:{"kind":type(v).__name__,"hasContent":bool(v)} for k,v in fs.items() if k not in known}
    warnings=[]
    if sitemap_name_diff:warnings.append('Sitemap name differs from canonical page title: '+expected_name)
    if not costText:warnings.append("No page cost description")
    if not equipment:warnings.append("No confidently scoped starting equipment links")
    if not default_rules:warnings.append("No confidently scoped default rule links")
    if fs.get("options") and not options:warnings.append("Option rich text present but hierarchy not extracted")
    if extra:warnings.append("Unmapped source fields present: "+", ".join(extra))
    return {
        "schemaVersion":"1.1.0","recordType":"unit-source-extract",
        "id":"unit:"+slug,"name":name,"nameSingular":fs.get("nameSingular"),
        "source":meta,
        "classification":{
          "unitCategory":[r["name"] for r in unit_category],
          "troopType":[r["name"] for r in troop_type],
          "baseSize":base_size,
          "baseSizeMm":base_mm,
          "unitSize":fs.get("unitSize")},
        "basePoints":{"amount":am,"basis":basis,"isAdditive":is_additive,"sourceText":costText},
        "modelProfiles":profiles,
        "startingEquipment":equipment,
        "startingRules":default_rules,
        "optionalRules":optional_rules,
        "upgradeGroups":options,
        "sourceAssociations":refs_from_contentful(fs,"association"),
        "sourceArmyLists":refs_from_contentful(fs,"armyLists"),
        "sourceBookPage":fs.get("pageReference"),
        "unmappedSourceFields":extra,
        "extractionWarnings":warnings,
        "legalityVerified":False,"engineImplemented":False
    }

def extract_army(html,url,name,known_units):
    soup,e=next_entry(html)
    fields=e.get("fields",{})
    title=clean(fields.get("name")) or name
    if title.lower()!=name.lower():raise ValueError("Army source name mismatch "+name+" vs "+title)
    refs=[];seen=set();main=soup.find("main") or soup
    for a in main.select("a[href]"):
        u=safe(a.get("href"),"unit")
        if u and u in known_units and u not in seen:
            seen.add(u);refs.append({"unitId":"unit:"+u.rsplit("/",1)[-1],"name":clean(a.get_text(' ',strip=True)),"sourceUrl":u})
    meta=get_source_metadata(soup,e)
    meta["sourceUrl"]=url
    meta["htmlSha256"]=hashlib.sha256(html.encode("utf-8")).hexdigest()
    return {"id":"army:"+url.rsplit("/",1)[-1],"name":title,"source":meta,
            "listedUnits":refs,"verificationStatus":"source-extracted"}

def main():
    OUTPUT.mkdir(exist_ok=True)
    check_robots()
    html=fetch(SITEMAP)
    entries=entries_from_sitemap(html)
    units=[x for x in entries if x["kind"]=="unit"]
    armies=[x for x in entries if x["kind"]=="army"]
    if PILOT:units=units[:PILOT];armies=armies[:min(PILOT,2)]
    lookup={x["sourceUrl"] for x in entries if x["kind"]=="unit"}
    print(f"Sitemap: {len(armies)} army pages and {len(units)} unit pages to fetch; pilot={PILOT}",flush=True)
    exported_units=[];exported_armies=[];failed=[]
    for ix,item in enumerate(units,1):
        try:
            html=fetch(item["sourceUrl"])
            rec=extract_unit(html,item["sourceUrl"],item["name"])
            exported_units.append(rec)
            if ix<=4:print(f"SAMPLE {rec['name']}: models={len(rec['modelProfiles'])}, options={sum(len(x['options']) for x in rec['upgradeGroups'])}, rules={len(rec['startingRules'])}, equipment={len(rec['startingEquipment'])}, updated={rec['source']['sourceUpdatedAt']}",flush=True)
        except Exception as exc:
            failed.append({"kind":"unit","name":item["name"],"sourceUrl":item["sourceUrl"],"error":str(exc)[:350]})
            print("UNIT ERROR",item["name"],str(exc)[:150],flush=True)
            if "blocked or rate-limited" in str(exc):break
        if ix%25==0:
            print(f"progress units={ix}/{len(units)} success={len(exported_units)} failure={len(failed)}",flush=True)
        time.sleep(DELAY)
    if not any("blocked or rate-limited" in x["error"] for x in failed):
        for ix,item in enumerate(armies,1):
            try:
                html=fetch(item["sourceUrl"])
                rec=extract_army(html,item["sourceUrl"],item["name"],lookup)
                exported_armies.append(rec)
            except Exception as exc:
                failed.append({"kind":"army","name":item["name"],"sourceUrl":item["sourceUrl"],"error":str(exc)[:350]})
                print("ARMY ERROR",item["name"],str(exc)[:150],flush=True)
                if "blocked or rate-limited" in str(exc):break
            time.sleep(DELAY)
    affiliation={}
    for army in exported_armies:
        for unit in army["listedUnits"]:
            affiliation.setdefault(unit["sourceUrl"],[]).append({"armyId":army["id"],"name":army["name"],"sourceUrl":army["source"]["sourceUrl"],"status":"source-listed"})
    for unit in exported_units:
        unit["listedInArmies"]=affiliation.get(unit["source"]["sourceUrl"],[])
    results={
        "schemaVersion":"1.1.0","recordType":"all-army-unit-source-export",
        "source":{"origin":ROOT,"sitemapUrl":SITEMAP,"checkedAt":checked_at,
                  "verificationStatus":"source-extracted"},
        "coverage":{"sourceUnitCount":len([x for x in entries if x["kind"]=="unit"]),
                    "sourceArmyCount":len([x for x in entries if x["kind"]=="army"]),
                    "unitPagesFetched":len(exported_units),"armyPagesFetched":len(exported_armies),
                    "failedPages":len(failed),"pilot":bool(PILOT)},
        "units":exported_units,"armies":exported_armies,"failures":failed
    }
    target=OUTPUT/("old-world-all-armies-units.json" if not PILOT else "pilot-units.json")
    target.write_text(json.dumps(results,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    summary={"coverage":results["coverage"],
             "profiles":sum(len(x["modelProfiles"]) for x in exported_units),
             "optionGroups":sum(len(x["upgradeGroups"]) for x in exported_units),
             "upgradeOptions":sum(sum(len(g["options"]) for g in x["upgradeGroups"]) for x in exported_units),
             "unitDetailsWithEquipment":sum(bool(x["startingEquipment"]) for x in exported_units),
             "unitDetailsWithRules":sum(bool(x["startingRules"]) for x in exported_units),
             "unitDetailsWithOptions":sum(bool(x["upgradeGroups"]) for x in exported_units),
             "filesizeBytes":target.stat().st_size}
    (OUTPUT/"coverage.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("FINAL COVERAGE",json.dumps(summary),flush=True)
    if PILOT:
        names=[(x["name"], x["classification"],x["basePoints"],x["upgradeGroups"][:2]) for x in exported_units]
        print("PILOT INSPECTION",str(names)[:3500],flush=True)
    if failed or len(exported_units)!=len(units) or len(exported_armies)!=len(armies):
        raise RuntimeError("Incomplete network extraction; inspect failures in coverage and JSON")
if __name__=="__main__":
    main()
