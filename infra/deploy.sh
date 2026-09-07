#!/bin/bash
# Explicit operator deployment into a configured GCP project. Run from repository root.
set -euo pipefail
: "${PROJECT:?Set PROJECT}" "${REGION:?Set REGION}" "${REVIEWER_SERVICE:?Set REVIEWER_SERVICE}" "${WEB_SERVICE:?Set WEB_SERVICE}"
# IAM, queue, buckets, service identities and secret bindings must already exist.
# Source uploads respect .gcloudignore, keeping local credentials and data out of builds.
gcloud run deploy "$REVIEWER_SERVICE" --source . --project "$PROJECT" --region "$REGION" --quiet
IMAGE=$(gcloud run services describe "$REVIEWER_SERVICE" --project "$PROJECT" --region "$REGION" --format='value(spec.template.spec.containers[0].image)')
gcloud run deploy "$WEB_SERVICE" --image "$IMAGE" --project "$PROJECT" --region "$REGION" --quiet
