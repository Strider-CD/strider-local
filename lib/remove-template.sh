#!/usr/bin/env sh
rm $(dirname "$0")/hooks/post-commit
rm $(readlink -f "$0")
curl -X DELETE
