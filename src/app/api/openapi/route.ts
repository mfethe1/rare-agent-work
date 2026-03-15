import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Remaining": "100",
};

const OPENAPI_SPEC = `openapi: 3.1.0
info:
  title: RareAgent API
  version: 1.0.0
  description: |
    The RareAgent API provides programmatic access to curated AI intelligence:
    news feeds, research reports, model rankings, and agent authentication.
  contact:
    email: api@rareagent.work
  license:
    name: MIT
servers:
  - url: https://rareagent.work/api/v1
    description: Production
  - url: http://localhost:3000/api/v1
    description: Local development

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: ra_<uuid>
  schemas:
    Error:
      type: object
      required: [error, code, status]
      properties:
        error:
          type: string
        code:
          type: string
        status:
          type: integer
    OperatorSignal:
      type: object
      properties:
        action_required:
          type: boolean
        risk_level:
          type: string
          enum: [low, medium, high]
    NewsItem:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        summary:
          type: string
        tags:
          type: array
          items:
            type: string
        source_url:
          type: string
          format: uri
        published_at:
          type: string
          format: date-time
        operator_signal:
          $ref: '#/components/schemas/OperatorSignal'
        relevance_score:
          type: number
          minimum: 0
          maximum: 1
    Pagination:
      type: object
      properties:
        total:
          type: integer
        limit:
          type: integer
        offset:
          type: integer
        has_more:
          type: boolean
    ModelItem:
      type: object
      properties:
        model_name:
          type: string
        provider:
          type: string
        capabilities:
          type: array
          items:
            type: string
        ranking_score:
          type: number
        last_verified_at:
          type: string
          format: date-time
    ReportPreview:
      type: object
      properties:
        slug:
          type: string
        title:
          type: string
        status:
          type: string
          enum: [draft, pending_review, approved, published]
        summary:
          type: string
        preview:
          type: string
        price_credits:
          type: integer
        updated_at:
          type: string
          format: date-time
    AgentRegistration:
      type: object
      required: [name, description, capabilities]
      properties:
        name:
          type: string
        description:
          type: string
        capabilities:
          type: array
          items:
            type: string
        callback_url:
          type: string
          format: uri

paths:
  /auth/register:
    post:
      summary: Register an agent
      description: Register an autonomous agent and receive an API key
      tags: [Auth]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AgentRegistration'
      responses:
        '201':
          description: Agent registered successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  agent_id:
                    type: string
                  api_key:
                    type: string
                    description: Store securely — shown only once
                  created_at:
                    type: string
                    format: date-time
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/verify:
    post:
      summary: Verify agent token
      tags: [Auth]
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Token is valid
          content:
            application/json:
              schema:
                type: object
                properties:
                  valid:
                    type: boolean
                  agent:
                    type: object
                    properties:
                      id:
                        type: string
                      name:
                        type: string
                      scopes:
                        type: array
                        items:
                          type: string
        '401':
          description: Invalid or missing token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /news:
    get:
      summary: List AI news items
      description: Paginated, filtered list of curated AI news with operator signals
      tags: [News]
      parameters:
        - name: tags
          in: query
          schema:
            type: string
          description: Comma-separated tag filter (e.g. agents,openai)
        - name: since
          in: query
          schema:
            type: string
            format: date-time
        - name: until
          in: query
          schema:
            type: string
            format: date-time
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
        - name: sort
          in: query
          schema:
            type: string
            enum: [newest, oldest, relevance]
            default: newest
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/NewsItem'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
                  meta:
                    type: object

  /news/{id}:
    get:
      summary: Get single news item
      tags: [News]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NewsItem'
        '404':
          description: Not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /reports:
    get:
      summary: List published reports
      tags: [Reports]
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/ReportPreview'
                  meta:
                    type: object

  /reports/{slug}:
    get:
      summary: Get full report
      tags: [Reports]
      security:
        - BearerAuth: []
      parameters:
        - name: slug
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Full report content
        '402':
          description: Credits required
          content:
            application/json:
              schema:
                type: object
                properties:
                  preview:
                    type: string
                  purchase_url:
                    type: string
                    format: uri
        '404':
          description: Not found

  /models:
    get:
      summary: List ranked AI models
      tags: [Models]
      parameters:
        - name: provider
          in: query
          schema:
            type: string
        - name: capability
          in: query
          schema:
            type: string
        - name: min_score
          in: query
          schema:
            type: number
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/ModelItem'
                  meta:
                    type: object

  /models/compare:
    get:
      summary: Compare models head-to-head
      tags: [Models]
      parameters:
        - name: ids
          in: query
          required: true
          schema:
            type: string
          description: Comma-separated model names to compare
      responses:
        '200':
          description: Comparison table
        '400':
          description: Invalid request
`;

export async function GET() {
  return new NextResponse(OPENAPI_SPEC, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/yaml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
