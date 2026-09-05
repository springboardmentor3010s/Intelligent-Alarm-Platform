# react-tailwind-dashboard

## Purpose & Use Case
Modular web dashboard components, analytics visualization, and JWT auth flow for the Wellness Coach and Admin dashboards. Ensures consistent UI/UX across web management interfaces.

## Rules & Standard Workflows
1. **JWT Auth Flow**: All dashboard routes must protect via a middleware that validates the JWT token from `Authorization: Bearer <token>` header. If invalid/expired, return `401 Unauthorized`. Store token in `HttpOnly` cookie or `localStorage` with automatic refresh using a refresh-endpoint.
2. **Modular Components**: Dashboard pages must be composed of reusable React components stored under `components/dashboard/`. Each component must accept `className` prop for Tailwind styling and emit custom events for state changes.
3. **Tailwind CSS Configuration**: Use `tailwindcss Just-In-Time` mode. Configure `content:` array to scan `components/**/*.{js,jsx,ts,jsx}`, `pages/**/*.{js,jsx,ts,jsx}`. Never use `@apply` for complex layouts; prefer composing Tailwind utilities.
4. **Analytics Visualization**: Use Chart.js or Plotly for dashboards. All charts must have responsive `width: 100%` and `maxWidth` constraints. Provide fallback static text representation if canvas fails.
5. **Data Fetching**: Use `fetch()` with `Authorization: Bearer <token>` header in `useEffect`. Implement `useQuery` from React Query for caching, stale-while-revalidate, and automatic refetch on window focus.

## Best Practices & Guardrails
- Use TypeScript interfaces for all chart data props and API response types.
- Implement error boundaries around chart components to prevent page-wide crashes.
- Keep dashboard pages under 500 lines; extract sub-components for anything larger.
- Configure Prettier to format Tailwind class ordering consistently.
- Add `aria-label` to all interactive chart elements for accessibility.

## Skill Invocation
- Trigger when: a user says "create dashboard", "fix chart visualization", or "add admin route".
- Response must include: JWT auth middleware pattern, Tailwind component structure, and chart visualization reference.