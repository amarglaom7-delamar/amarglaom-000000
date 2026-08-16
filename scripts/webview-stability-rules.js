const TRACKER_HOSTS = new Set(['doubleclick.net','googlesyndication.com','google-analytics.com','connect.facebook.net','adnxs.com','adsrvr.org','scorecardresearch.com','hotjar.com']);
function hostnameOf(url){try{return new URL(url).hostname.toLowerCase()}catch(_){return ''}}
function isKnownTracker(url){const h=hostnameOf(url);return !!h&&[...TRACKER_HOSTS].some(d=>h===d||h.endsWith('.'+d))}
function shouldBlockNavigation(url,{blockTrackers=true}={}){if(!url)return false;if(blockTrackers&&isKnownTracker(url))return true;if(/^(javascript|data):/i.test(url))return true;return false}
module.exports={TRACKER_HOSTS,hostnameOf,isKnownTracker,shouldBlockNavigation};
