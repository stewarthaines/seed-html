#!/bin/sh

# cd how_things_fail.epub
# MODIFIED=`date "+%Y-%m-%dT%H:%M:%SZ"`
# sed -i .bak 's/modified">.*</modified">'"$MODIFIED"'</' OEBPS/content.opf
# rm OEBPS/content.opf.bak
rm -f ../packed.epub
zip ../packed.epub -X mimetype
zip ../packed.epub META-INF/*
# zip -r ../packed.epub EPUB/*
zip -r ../packed.epub OEBPS/*
