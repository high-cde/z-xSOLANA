#!/bin/bash
u="$1"
for i in 1 2 3; do
out=$(curl -sSL -m 25 -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36" -o /tmp/vc_$$.html -w "%{http_code}\t%{url_effective}" "$u" 2>/dev/null)
case "$out" in 2*|3*) break;; esac
sleep 3
done
t=$(grep -o -i "<title[^>]*>[^<]*" /tmp/vc_$$.html 2>/dev/null | head -1 | sed 's/<title[^>]*>//' | tr -d '\t\n\r' | cut -c1-70)
rm -f /tmp/vc_$$.html
printf "%s\t%s\t%s\n" "$u" "$out" "$t"
