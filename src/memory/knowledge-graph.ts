// ─────────────────────────────────────────────────────────
// memory/knowledge-graph.ts — Entity-relationship knowledge graph
// ─────────────────────────────────────────────────────────
import { getDb } from "./db.js";
import { registerTool } from "../tools/registry.js";

interface Entity {
    id: number;
    name: string;
    type: string;
    properties: string | null;
    created_at: string;
}

interface Relationship {
    id: number;
    from_name: string;
    to_name: string;
    relation: string;
    weight: number;
}

/** Add or get an entity */
export function addEntity(
    name: string,
    type = "concept",
    properties?: Record<string, unknown>
): Entity {
    const db = getDb();
    db.prepare(
        `INSERT OR IGNORE INTO entities (name, type, properties) VALUES (?, ?, ?)`
    ).run(name.toLowerCase(), type, properties ? JSON.stringify(properties) : null);

    return db
        .prepare(`SELECT * FROM entities WHERE name = ?`)
        .get(name.toLowerCase()) as Entity;
}

/** Add a relationship between entities */
export function addRelationship(
    fromName: string,
    toName: string,
    relation: string,
    weight = 1.0
): void {
    const db = getDb();
    const from = addEntity(fromName);
    const to = addEntity(toName);

    db.prepare(
        `INSERT OR REPLACE INTO relationships (from_entity, to_entity, relation, weight)
     VALUES (?, ?, ?, ?)`
    ).run(from.id, to.id, relation, weight);
}

/** Query the graph — find connections for an entity */
export function queryGraph(entityName: string): {
    entity: Entity | null;
    connections: Relationship[];
} {
    const db = getDb();
    const entity = db
        .prepare(`SELECT * FROM entities WHERE name = ?`)
        .get(entityName.toLowerCase()) as Entity | undefined;

    if (!entity) return { entity: null, connections: [] };

    const connections = db
        .prepare(
            `SELECT r.id, e1.name as from_name, e2.name as to_name, r.relation, r.weight
       FROM relationships r
       JOIN entities e1 ON r.from_entity = e1.id
       JOIN entities e2 ON r.to_entity = e2.id
       WHERE r.from_entity = ? OR r.to_entity = ?
       ORDER BY r.weight DESC`
        )
        .all(entity.id, entity.id) as Relationship[];

    return { entity, connections };
}

/** Get all entities */
export function listEntities(limit = 50): Entity[] {
    const db = getDb();
    return db
        .prepare(`SELECT * FROM entities ORDER BY created_at DESC LIMIT ?`)
        .all(limit) as Entity[];
}

// ── Register knowledge graph tools ───────────────────────

registerTool({
    schema: {
        type: "function",
        function: {
            name: "add_knowledge",
            description:
                "Add an entity and/or relationship to the knowledge graph. Use to build a connected web of knowledge about people, concepts, projects, etc.",
            parameters: {
                type: "object",
                properties: {
                    entity: { type: "string", description: "Entity name." },
                    entity_type: {
                        type: "string",
                        description: 'Entity type: "person", "concept", "project", "place", "tool", etc.',
                    },
                    related_to: {
                        type: "string",
                        description: "Another entity this one is related to (optional).",
                    },
                    relation: {
                        type: "string",
                        description: 'The relationship label, e.g. "works_on", "knows", "uses", "located_in".',
                    },
                },
                required: ["entity"],
            },
        },
    },
    async execute(input) {
        const entity = addEntity(
            input.entity as string,
            (input.entity_type as string) || "concept"
        );

        if (input.related_to && input.relation) {
            addRelationship(
                input.entity as string,
                input.related_to as string,
                input.relation as string
            );
            return `✅ Added "${entity.name}" (${entity.type}) → ${input.relation} → "${input.related_to}"`;
        }

        return `✅ Added entity "${entity.name}" (${entity.type})`;
    },
});

registerTool({
    schema: {
        type: "function",
        function: {
            name: "query_knowledge",
            description:
                "Query the knowledge graph for an entity and its connections.",
            parameters: {
                type: "object",
                properties: {
                    entity: { type: "string", description: "Entity name to look up." },
                },
                required: ["entity"],
            },
        },
    },
    async execute(input) {
        const { entity, connections } = queryGraph(input.entity as string);
        if (!entity) return `No entity named "${input.entity}" found.`;

        let result = `Entity: ${entity.name} (${entity.type})\n`;
        if (connections.length === 0) {
            result += "No connections.";
        } else {
            result += "Connections:\n";
            result += connections
                .map((c) => `  ${c.from_name} —[${c.relation}]→ ${c.to_name}`)
                .join("\n");
        }
        return result;
    },
});
