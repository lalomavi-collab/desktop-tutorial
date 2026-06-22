# Data replication on GCP (Cloud SQL read replicas)

This addresses "Step 4" of the infra plan: distributed, secure DB replication.

For the data tier we recommend **managed Cloud SQL with read replicas** over a
self-managed Postgres `StatefulSet`, so the AI/read traffic is offloaded from the
primary without us owning failover/backup.

## 1. Create a read replica

```bash
gcloud beta sql instances create legal-db-replica \
    --master-instance-name=legal-db-main \
    --region=europe-west1
```

(`europe-west1` keeps data in-region for privacy posture; choose per your
compliance requirements.)

## 2. Route read traffic via the Cloud SQL Auth Proxy

The `ai-core` and `peer-room` read paths connect to the **replica** through the
Cloud SQL Auth Proxy (built into Cloud Code), while writes go to the primary:

| Service | Path | Target |
|---|---|---|
| ingestion | write | `legal-db-main` (primary) |
| peer-room  | write (votes) / read (browse) | primary / `legal-db-replica` |
| ai-core    | read-only | `legal-db-replica` |

This keeps the primary unburdened under heavy AI read load while preserving a
single source of truth for writes.

## 3. Privacy note

The replica only ever holds **already-anonymized** `LdrCase` rows (see
`schema/ldr_case.schema.json`). No raw client data exists anywhere in the data
tier — the zero-knowledge boundary is upstream, on the client.
