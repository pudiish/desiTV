# TypeScript Setup Guide

## 📦 Required Dependencies

### Client (`client/package.json`)
```bash
cd client
npm install -D typescript @types/react @types/react-dom @types/node @types/three
```

**Add to `devDependencies`:**
```json
{
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "@types/node": "^20.10.6",
    "@types/three": "^0.160.0"
  }
}
```

### Server (`server/package.json`)
```bash
cd server
npm install -D typescript @types/node @types/express @types/mongoose @types/bcrypt @types/jsonwebtoken @types/compression tsx
```

**Add to `devDependencies`:**
```json
{
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.10.6",
    "@types/express": "^4.17.21",
    "@types/mongoose": "^5.11.97",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/compression": "^1.7.5",
    "tsx": "^4.7.0"
  }
}
```

## ✅ Configuration Files Created

1. ✅ `client/tsconfig.json` - Client TypeScript config
2. ✅ `client/tsconfig.node.json` - Node-specific config
3. ✅ `server/tsconfig.json` - Server TypeScript config
4. ✅ `client/src/types/index.ts` - Client type definitions
5. ✅ `server/src/types/index.ts` - Server type definitions

## 🚀 Next Steps

1. Install dependencies (run commands above)
2. Verify TypeScript works: `npx tsc --noEmit` (in client/server directories)
3. Start converting files gradually
