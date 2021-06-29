#!/bin/bash

# Get the root path of the repo
ROOT=$(git rev-parse --show-toplevel)
echo "Found repo root: ${ROOT}"

# Get the version from package.json
PACKAGE_VERSION=$(cat ${ROOT}/packages/*/package.json \
  | grep @sixriver/standard-api \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')
echo "Extracted version: ${PACKAGE_VERSION}"

# Find the yaml files in packages/oas tht are committed to git
YAML_FILES=$(git ls-files ${ROOT}/packages/oas/ \
  | xargs -I {} find {} -type f -maxdepth 3 -name "*.yaml")
echo ${YAML_FILES}

# Now do the replacement in-place (MacOS/Unix compatible) https://frontend-apps.6river.org/api/v${PACKAGE_VERSION}
for FILE in ${YAML_FILES}
do
  if grep -q "https://frontend-apps.6river.org/api/v" ${ROOT}/${FILE}
  then
    sed -i.bak -e "s#\(https://frontend-apps.6river.org/api/v\)[^/]*/#https://frontend-apps.6river.org/api/v${PACKAGE_VERSION}/#g" "${ROOT}/${FILE}"
    rm ${ROOT}/${FILE}.bak
  fi
done