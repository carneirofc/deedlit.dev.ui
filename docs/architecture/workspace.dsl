workspace "deedlit.dev" "C4 model of the deedlit.dev monorepo: the public landing site plus ComfyHelper, a self-hosted generated-image library backed by a mesh of FastAPI services (database-per-service, HTTP-only)." {

    !identifiers hierarchical

    model {
        # --- People ---------------------------------------------------------
        user = person "Self-hoster" "Generates images locally, then browses, searches and curates the library."
        agent = person "External AI agent" "Automated agent that drives the library through the MCP tool surface." "External"

        # --- External systems ----------------------------------------------
        comfy = softwareSystem "ComfyUI / Automatic1111" "Local image generators; write generated images with embedded prompt/params/workflow metadata into the library folder." {
            tags "External"
        }
        library = softwareSystem "Image library folder" "Local filesystem of generated outputs. Bind-mounted read-only into ingest containers at /library." {
            tags "External"
        }
        llama = softwareSystem "llama-server (llama.cpp)" "Local OpenAI-compatible vision LLM. Reached from containers via host.docker.internal." {
            tags "External"
        }

        # --- The system -----------------------------------------------------
        deedlit = softwareSystem "deedlit.dev" "Self-hosted generated-image library plus public landing site." {

            # Web apps (pnpm workspace) --------------------------------------
            ui = container "@carneirofc/ui" "Shared React component library. Build-time only — compiled into the two web apps, not a runtime service." "TypeScript / React (build-time)" {
                tags "Library"
            }
            dev = container "deedlit.dev" "Public landing site: home / services hub, image gallery, reference book shelf. Port 3001." "Next.js" {
                tags "Web App"
            }
            comfyhelper = container "ComfyHelper UI" "Image-library browser: hybrid search, tag/safety filters, Neo4j graph filter, admin/ingest pages. Talks only to the gateway. Port 3000." "Next.js" {
                tags "Web App"
            }

            # Services (FastAPI, uv per-package venv) -----------------------
            api = container "deedlit.api" "Gateway / BFF: aggregate detail pages, host the MCP tool surface, dispatch ingest jobs. Owns no datastore; the single reader that fans across services. Port 8088." "FastAPI (Python)" {
                tags "Service"
            }
            catalog = container "deedlit.catalog" "Canonical truth: images, tags, params, references, ratings, notes, collections; thumbnails + cached embeddings. Sole writer of Postgres + RustFS. Port 8001." "FastAPI (Python)" {
                tags "Service" "Owner"
            }
            search = container "deedlit.search" "Dense (CLIP) + sparse (SPLADE) named vectors, RRF hybrid query. Sole writer of Qdrant; rebuildable projection of catalog. Port 8002." "FastAPI (Python)" {
                tags "Service" "Owner"
            }
            graph = container "deedlit.graph" "Shared-asset, tag co-occurrence and lineage edges. Sole writer of Neo4j; rebuildable projection of catalog. Port 8003." "FastAPI (Python)" {
                tags "Service" "Owner"
            }
            ingest = container "deedlit.ingest" "Scan folder, sha256 / phash / dims / thumbnail; call metadata + vision; fan out writes. The only multi-service writer. Queue-driven per-stage DAG. Port 8004 (+ workers)." "FastAPI (Python)" {
                tags "Service"
            }
            metadata = container "deedlit.metadata" "Bytes to embedded parse: prompt / negative / tags / params + resolved reference graph. No datastore. Port 8005." "FastAPI (Python)" {
                tags "Service"
            }
            labelagent = container "deedlit.labelagent" "Vision-LLM describe / safety / tags via a local llama-server. No datastore. Port 8006." "FastAPI (Python)" {
                tags "Service"
            }
            vision = container "deedlit.vision" "CLIP dense (image/text, 1024-dim) + SPLADE sparse embeddings. GPU. No datastore. Port 8000." "FastAPI (Python), GPU" {
                tags "Service"
            }

            # Datastores & infra --------------------------------------------
            postgres = container "PostgreSQL" "Catalog canonical truth + ingest durability layer (inventories, task ledger, job history, settings). Port 5432." "PostgreSQL 16" {
                tags "Database"
            }
            rustfs = container "RustFS" "S3-compatible blob storage: thumbnails + cached embeddings. Ports 9000/9001." "RustFS (S3)" {
                tags "Database"
            }
            qdrant = container "Qdrant" "Vector store: dense + sparse named vectors, HNSW (GPU index build). Ports 6333/6334." "Qdrant" {
                tags "Database"
            }
            neo4j = container "Neo4j" "Relationship graph: shared assets, tag co-occurrence, lineage. Ports 7474/7687." "Neo4j 5" {
                tags "Database"
            }
            rabbitmq = container "RabbitMQ" "Broker for the per-stage ingest DAG (choreography, no orchestrator). Ports 5672/15672." "RabbitMQ" {
                tags "Queue"
            }
            redis = container "Redis" "Bounded LRU hot cache for image bytes in front of RustFS. Port 6379." "Redis 7" {
                tags "Database"
            }
        }

        # --- Relationships --------------------------------------------------
        # People -> web apps / MCP
        user -> deedlit.dev "Browses the site & services hub" "HTTPS"
        user -> deedlit.comfyhelper "Searches & curates the library" "HTTPS"
        agent -> deedlit.api "Calls MCP tools" "MCP / JSON-RPC"

        # Shared UI is compiled into the web apps
        deedlit.ui -> deedlit.dev "Provides components to" "build-time"
        deedlit.ui -> deedlit.comfyhelper "Provides components to" "build-time"

        # Frontends talk only to the BFF
        deedlit.dev -> deedlit.api "Reads via" "HTTPS / JSON"
        deedlit.comfyhelper -> deedlit.api "Reads & dispatches via" "HTTPS / JSON"

        # Gateway fan-out (the only reader across services)
        deedlit.api -> deedlit.catalog "Aggregates records, ratings, notes, collections" "HTTP"
        deedlit.api -> deedlit.search "Similar / semantic search" "HTTP"
        deedlit.api -> deedlit.graph "Neighbors / lineage" "HTTP"
        deedlit.api -> deedlit.ingest "Dispatches ingest / reindex / delete jobs" "HTTP"
        deedlit.api -> deedlit.metadata "On-demand extract" "HTTP"
        deedlit.api -> deedlit.labelagent "On-demand label" "HTTP"

        # Ingest DAG (the only multi-service writer)
        deedlit.ingest -> library "Scans folders, reads bytes" "filesystem (ro)"
        deedlit.ingest -> deedlit.metadata "Extract embedded metadata" "HTTP POST /extract"
        deedlit.ingest -> deedlit.vision "Embed image (dense) + text (sparse)" "HTTP"
        deedlit.ingest -> deedlit.catalog "Writes record + thumbnail (durability boundary, first)" "HTTP POST"
        deedlit.ingest -> deedlit.search "Upsert dense + sparse point" "HTTP POST"
        deedlit.ingest -> deedlit.graph "Upsert reference / tag / lineage edges" "HTTP POST"
        deedlit.ingest -> deedlit.rabbitmq "Publishes / consumes per-stage DAG messages" "AMQP"

        # Labelling
        deedlit.labelagent -> llama "Describe / safety / tags" "OpenAI /v1 (HTTP)"
        deedlit.labelagent -> deedlit.catalog "Patch description / safety / tags" "HTTP"
        deedlit.labelagent -> deedlit.search "Re-embed on text change" "HTTP"
        deedlit.labelagent -> deedlit.graph "Re-index on tag change" "HTTP"

        # Owners -> their stores (owners never call each other)
        deedlit.catalog -> deedlit.postgres "Reads / writes" "SQL (asyncpg)"
        deedlit.catalog -> deedlit.rustfs "Stores / serves blobs" "S3"
        deedlit.catalog -> deedlit.redis "Caches image bytes" "RESP"
        deedlit.search -> deedlit.qdrant "Reads / writes vectors" "HTTP/gRPC"
        deedlit.graph -> deedlit.neo4j "Reads / writes graph" "Bolt / Cypher"

        # External producer
        comfy -> library "Writes generated images + metadata" "filesystem"

        # --- Deployment: local Docker Compose ------------------------------
        deploymentEnvironment "Local (Docker Compose)" {
            host = deploymentNode "Docker host" "Linux host running the 'deedlit' Compose project (docker compose up)." {

                webNode = deploymentNode "Web apps" "pnpm workspace (Next.js)" {
                    containerInstance deedlit.dev
                    containerInstance deedlit.comfyhelper
                }

                svcNode = deploymentNode "FastAPI services" "uv per-package venv; OTLP tracing to Alloy" {
                    containerInstance deedlit.api
                    containerInstance deedlit.catalog
                    containerInstance deedlit.search
                    containerInstance deedlit.graph
                    containerInstance deedlit.ingest
                    containerInstance deedlit.metadata
                    containerInstance deedlit.labelagent

                    gpuSvc = deploymentNode "GPU (profile: vision | full)" "NVIDIA container runtime" {
                        containerInstance deedlit.vision
                    }
                }

                dataNode = deploymentNode "Datastores" "Persistent Docker volumes" {
                    containerInstance deedlit.postgres
                    containerInstance deedlit.neo4j
                    containerInstance deedlit.rustfs
                    containerInstance deedlit.rabbitmq
                    containerInstance deedlit.redis

                    gpuData = deploymentNode "GPU (device reservation)" "NVIDIA container runtime — HNSW index build" {
                        containerInstance deedlit.qdrant
                    }
                }
            }

            hostMachine = deploymentNode "Host machine (outside Docker)" "Reached from containers via host.docker.internal / bind mount." {
                softwareSystemInstance llama
                softwareSystemInstance library
            }
        }
    }

    views {
        systemContext deedlit "SystemContext" "Who and what deedlit.dev talks to." {
            include *
            autolayout lr
        }

        container deedlit "Containers" "Web apps, FastAPI services and datastores inside deedlit.dev." {
            include *
            autolayout lr
        }

        dynamic deedlit "IngestDAG" "Ingesting a new image: queue-driven per-stage DAG. Catalog is the durability boundary (written first); search/graph are rebuildable projections." {
            comfy -> library "1. Writes a generated image + embedded metadata"
            deedlit.ingest -> library "2. Scans folder; computes sha256 (cross-service id), phash, dims, thumbnail"
            deedlit.ingest -> deedlit.metadata "3. Extract prompt / tags / params + reference graph"
            deedlit.ingest -> deedlit.vision "4. Embed dense (CLIP) + sparse (SPLADE)"
            deedlit.ingest -> deedlit.catalog "5. Write record + thumbnail (rendezvous / durability first)"
            deedlit.ingest -> deedlit.search "6. Upsert dense + sparse vector point"
            deedlit.ingest -> deedlit.graph "7. Upsert reference / tag / lineage edges"
            deedlit.labelagent -> llama "8. Describe / safety / tags"
            deedlit.labelagent -> deedlit.catalog "9. Patch description / safety / tags"
            deedlit.labelagent -> deedlit.search "10. Re-embed on text change"
            deedlit.labelagent -> deedlit.graph "11. Re-index on tag change"
            autolayout lr
        }

        dynamic deedlit "ReadFlow" "Serving a library detail / search request through the gateway." {
            user -> deedlit.comfyhelper "1. Opens an image / runs a search"
            deedlit.comfyhelper -> deedlit.api "2. Request via the BFF"
            deedlit.api -> deedlit.catalog "3. Aggregate the canonical record"
            deedlit.api -> deedlit.search "4. Similar / semantic results"
            deedlit.api -> deedlit.graph "5. Neighbors / lineage"
            autolayout lr
        }

        deployment deedlit "Local (Docker Compose)" "Deployment" "Containers mapped onto the Docker Compose stack: ports, GPU nodes and the external host machine." {
            include *
            autolayout lr
        }

        styles {
            element "Person" {
                shape Person
                background #08427b
                color #ffffff
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "Web App" {
                shape WebBrowser
                background #1168bd
                color #ffffff
            }
            element "Service" {
                shape RoundedBox
                background #438dd5
                color #ffffff
            }
            element "Owner" {
                background #2e6da4
                color #ffffff
            }
            element "Library" {
                shape Component
                background #85bbf0
                color #000000
            }
            element "Database" {
                shape Cylinder
                background #f5a623
                color #000000
            }
            element "Queue" {
                shape Pipe
                background #f5a623
                color #000000
            }
        }
    }
}
