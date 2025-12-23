/**
 * MSW Request Handlers
 *
 * Mock API handlers for testing. These intercept HTTP requests during tests
 * and return mock responses, enabling isolated component testing.
 */

import { http, HttpResponse } from 'msw';

// Use the same API base as the app, but default to test port
// In tests, import.meta.env is not available so we use a sensible default
const API_BASE = 'http://localhost:8000';

// Mock data
export const mockBusinesses = [
  {
    id: 'business-1',
    name: 'Test Company',
    created_at: '2024-01-01T00:00:00Z',
    departments: [
      { id: 'dept-1', name: 'Engineering', color: '#3B82F6' },
      { id: 'dept-2', name: 'Marketing', color: '#10B981' },
    ],
    roles: [
      { id: 'role-1', name: 'Developer', department_id: 'dept-1' },
      { id: 'role-2', name: 'Designer', department_id: 'dept-1' },
    ],
  },
];

export const mockConversations = [
  {
    id: 'conv-1',
    title: 'Test Conversation 1',
    created_at: '2024-01-15T10:00:00Z',
    message_count: 5,
    starred: false,
    archived: false,
  },
  {
    id: 'conv-2',
    title: 'Another Conversation',
    created_at: '2024-01-14T09:00:00Z',
    message_count: 3,
    starred: true,
    archived: false,
  },
];

export const mockConversationDetail = {
  id: 'conv-1',
  title: 'Test Conversation 1',
  created_at: '2024-01-15T10:00:00Z',
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'What is the best approach for this?',
    },
    {
      id: 'msg-2',
      role: 'assistant',
      stage1: [
        { model: 'gpt-4', response: 'Response from GPT-4' },
        { model: 'claude', response: 'Response from Claude' },
      ],
      stage2: [
        { model: 'gpt-4', ranking: 'Model A provides better analysis' },
      ],
      stage3: {
        model: 'chairman',
        response: 'Based on the council deliberation...',
      },
    },
  ],
};

export const mockProjects = [
  {
    id: 'proj-1',
    name: 'Project Alpha',
    description: 'Main project',
    status: 'active',
    department_id: 'dept-1',
    created_at: '2024-01-01T00:00:00Z',
  },
];

export const mockDecisions = [
  {
    id: 'dec-1',
    title: 'Architecture Decision',
    content: 'We decided to use microservices...',
    category: 'architecture',
    status: 'approved',
    created_at: '2024-01-10T00:00:00Z',
  },
];

// Request handlers
export const handlers = [
  // Businesses
  http.get(`${API_BASE}/api/businesses`, () => {
    return HttpResponse.json(mockBusinesses);
  }),

  http.get(`${API_BASE}/api/businesses/:id`, ({ params }) => {
    const business = mockBusinesses.find((b) => b.id === params.id);
    if (!business) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(business);
  }),

  // Conversations
  http.get(`${API_BASE}/api/conversations`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let filtered = mockConversations;
    if (search) {
      filtered = filtered.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      );
    }

    const paginated = filtered.slice(offset, offset + limit);

    return HttpResponse.json({
      conversations: paginated,
      has_more: offset + limit < filtered.length,
    });
  }),

  http.get(`${API_BASE}/api/conversations/:id`, ({ params }) => {
    if (params.id === 'conv-1') {
      return HttpResponse.json(mockConversationDetail);
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.post(`${API_BASE}/api/conversations`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: `conv-${Date.now()}`,
      title: 'New Conversation',
      created_at: new Date().toISOString(),
      company_id: body.company_id,
    });
  }),

  http.delete(`${API_BASE}/api/conversations/:id`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.post(`${API_BASE}/api/conversations/:id/star`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.post(`${API_BASE}/api/conversations/:id/archive`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Projects
  http.get(`${API_BASE}/api/companies/:companyId/projects`, () => {
    return HttpResponse.json(mockProjects);
  }),

  http.post(`${API_BASE}/api/companies/:companyId/projects`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: `proj-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
    });
  }),

  // Decisions
  http.get(`${API_BASE}/api/companies/:companyId/decisions`, () => {
    return HttpResponse.json(mockDecisions);
  }),

  // Departments
  http.get(`${API_BASE}/api/companies/:companyId/departments`, () => {
    return HttpResponse.json(mockBusinesses[0]?.departments || []);
  }),

  // Roles
  http.get(`${API_BASE}/api/companies/:companyId/roles`, () => {
    return HttpResponse.json(mockBusinesses[0]?.roles || []);
  }),

  // Playbooks
  http.get(`${API_BASE}/api/companies/:companyId/playbooks`, () => {
    return HttpResponse.json([]);
  }),

  // Members
  http.get(`${API_BASE}/api/companies/:companyId/members`, () => {
    return HttpResponse.json([
      { id: 'user-1', email: 'test@example.com', role: 'admin' },
    ]);
  }),

  // Company context
  http.get(`${API_BASE}/api/companies/:companyId/context`, () => {
    return HttpResponse.json({ context: 'Test company context' });
  }),

  // Health check
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({ status: 'ok' });
  }),
];
