# Deploy — Vercel (FE) + VPS (BE + PostgreSQL)

Production: https://workforce-management-fe-seven.vercel.app/

## Vercel (FE)

1. Import repo `workforce-management-FE`
2. **Không set** `VITE_API_BASE_URL` (mặc định production gọi `/api` cùng domain)
3. `vercel.json` proxy `/api` → VPS `http://168.144.38.133:8091`
4. Redeploy sau khi đổi `vercel.json`

## VPS (BE)

- API nội bộ: `127.0.0.1:8085`
- Nginx: `8091` (FE static + proxy `/api`)
- `Cors__Origins` cần có URL Vercel production + preview

Backend: [workforce-management-BE](https://github.com/DUUY69/workforce-management-BE)
