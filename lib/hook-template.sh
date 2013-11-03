
branch=`git branch | sed -n '/\* /s///p'`
message=`git log -1 --format='{"email": "%ae", "id": "%H", "message": "%s", "timestamp": "%ai", "branch": "'$branch'"}'`
curl -H "Content-Type: application/json" --data-ascii "$message" 
