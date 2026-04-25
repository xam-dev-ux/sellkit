# SELLKIT — Deploy guide

## Resumen del stack

| Componente | Dónde vive | Comando |
|------------|------------|---------|
| Contrato Solidity | Base mainnet | `npm run deploy` en `packages/contracts` |
| Agent (XMTP + API) | Railway | Deploy desde GitHub |
| Web (miniapp) | Vercel | Deploy desde GitHub |

---

## 0. Preparación local

### Requisitos
- **Node.js 20** via nvm (el sistema puede tener Node 12, pero Hardhat y Vite requieren 18+)
- Git
- ETH en Base mainnet para el gas del deploy del contrato (~0.005 ETH suficiente)

> **nvm ya está instalado en tu máquina.** Antes de cada sesión de trabajo con el proyecto, activa Node 20:
> ```bash
> export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
> nvm use 20   # o simplemente abre un nuevo terminal (el default es Node 20)
> node --version  # debe mostrar v20.x.x
> ```

### Clonar e instalar

```bash
git clone <tu-repo>
cd Sellkit
npm install --legacy-peer-deps
```

### Crear el `.env`

```bash
cp .env.example .env
```

El `.env.example` ya tiene todos los valores necesarios excepto `CONTRACT_ADDRESS` y `VITE_CONTRACT_ADDRESS`, que se rellenan después del deploy del contrato.

---

## 1. Desplegar el contrato en Base mainnet

### 1.1 Verificar saldo ETH del deployer

La `DEPLOYER_PRIVATE_KEY` del `.env` necesita ETH en Base mainnet para pagar el gas.

Puedes ver el address del deployer con:

```bash
node -e "
const { ethers } = require('ethers');
const w = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY);
console.log('Deployer address:', w.address);
"
```

Asegúrate de que tiene al menos **0.005 ETH** en Base mainnet. Puedes hacer bridge desde Ethereum en [bridge.base.org](https://bridge.base.org) o comprar directamente en Coinbase.

### 1.2 Compilar el contrato

```bash
cd packages/contracts
npm install --legacy-peer-deps
npx hardhat compile
```

Esto genera los artifacts en `packages/contracts/artifacts/` y los typechain types.

### 1.3 Desplegar a Base mainnet

```bash
npx hardhat run scripts/deploy.ts --network base
```

**Output esperado:**

```
Deploying with: 0xTU_ADDRESS
Balance: 0.005 ETH
SellKitRegistry deployed to: 0xCONTRACT_ADDRESS
Tx hash: 0xTX_HASH
Deployment saved to deployments/base-mainnet.json
Waiting 30s before Basescan verification...
Verified on Basescan
```

Copia el `CONTRACT_ADDRESS` del output.

### 1.4 Rellenar la address del contrato en `.env`

```bash
# Edita el .env y rellena:
CONTRACT_ADDRESS=0xCONTRACT_ADDRESS
VITE_CONTRACT_ADDRESS=0xCONTRACT_ADDRESS
```

### 1.5 Poblar con sellers de ejemplo (opcional pero recomendado)

```bash
npx hardhat run scripts/seed.ts --network base
```

Registra 5 sellers con servicios en distintas categorías para que la miniapp tenga datos desde el primer día.

### 1.6 Verificar en Basescan

Abre `https://basescan.org/address/0xCONTRACT_ADDRESS` y confirma que el contrato está verificado y las funciones aparecen en la pestaña "Contract > Read/Write".

---

## 2. Desplegar el agente en Railway

### 2.1 Preparar el repositorio en GitHub

```bash
git init
git add .
git commit -m "init sellkit monorepo"
git remote add origin https://github.com/TU_USER/sellkit.git
git push -u origin main
```

### 2.2 Crear el proyecto en Railway

1. Ve a [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Selecciona tu repositorio
3. Railway detectará el `railway.toml` en `packages/agent/`

> Si no detecta el `railway.toml` automáticamente, configura manualmente:
> - **Root Directory**: `.` (raíz del monorepo)
> - **Build Command**: `npm install --legacy-peer-deps && npm run build --workspace=packages/shared && npm run build --workspace=packages/agent`
> - **Start Command**: `node packages/agent/dist/index.js`

### 2.3 Configurar variables de entorno en Railway

En el panel de Railway → tu servicio → **Variables**, añade todas estas:

| Variable | Valor |
|----------|-------|
| `XMTP_WALLET_KEY` | el que tienes en `.env` |
| `XMTP_DB_ENCRYPTION_KEY` | el que tienes en `.env` |
| `XMTP_ENV` | `production` |
| `CONTRACT_ADDRESS` | la address del contrato desplegado |
| `RPC_URL` | `https://mainnet-preconf.base.org` |
| `OPERATOR_PRIVATE_KEY` | el que tienes en `.env` |
| `USDC_ADDRESS` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `TREASURY_ADDRESS` | el que tienes en `.env` |
| `ERC8004_REGISTRY_ADDRESS` | el que tienes en `.env` |
| `PORT` | `3001` |
| `MONTHLY_RESET_CRON` | `0 0 1 * *` |
| `AGENT_BASE_URL` | `https://TU-APP.railway.app` (lo sabrás después del primer deploy) |
| `NODE_ENV` | `production` |

### 2.4 Verificar el deploy

Railway hace el build automáticamente al hacer push. Una vez desplegado:

```bash
# Health check
curl https://TU-APP.railway.app/api/stats

# Debe devolver algo como:
# {"totalSellers":5,"totalServices":5,"totalTransactions":0,"totalVolumeUsdc":0,...}
```

### 2.5 Actualizar AGENT_BASE_URL

Una vez tengas la URL de Railway (ej. `sellkit-production.up.railway.app`), actualiza `AGENT_BASE_URL` en las variables de Railway y en tu `.env` local.

---

## 3. Desplegar la web en Vercel

### 3.1 Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com) → **New Project** → importa desde GitHub
2. Selecciona el mismo repositorio

### 3.2 Configurar el build

Vercel leerá el `vercel.json` de la raíz automáticamente:

```json
{
  "buildCommand": "npm run build --workspace=packages/web",
  "outputDirectory": "packages/web/dist",
  "framework": "vite"
}
```

Si Vercel pide que selecciones framework, elige **Other** y deja que el `vercel.json` lo maneje.

> **Importante**: Vercel usa Node 18 por defecto. En *Settings → General → Node.js Version* confirma que es **18.x** o superior.

### 3.3 Configurar variables de entorno en Vercel

En *Settings → Environment Variables*, añade:

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://TU-APP.railway.app` |
| `VITE_CONTRACT_ADDRESS` | la address del contrato |
| `VITE_CHAIN_ID` | `8453` |
| `VITE_USDC_ADDRESS` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `VITE_BASESCAN_URL` | `https://basescan.org` |
| `VITE_WALLETCONNECT_PROJECT_ID` | (opcional) tu project ID de [cloud.walletconnect.com](https://cloud.walletconnect.com) |

### 3.4 Deploy

Haz un `git push` o lanza el deploy manualmente desde el panel. Vercel construye y despliega en ~2 minutos.

### 3.5 Verificar

Abre la URL de Vercel. Deberías ver:
- La HomePage con los servicios del contrato en el stats bar
- Los 5 sellers de ejemplo si corriste el seed
- El `ContractLink` apuntando a la address correcta en Basescan

---

## 4. Verificación end-to-end

### Flujo 1 — Vendedor onboarding via XMTP

1. Instala [Converse](https://getconverse.app) o cualquier cliente XMTP
2. Busca el address del agente (la wallet de `XMTP_WALLET_KEY`)
3. Envía cualquier mensaje → el agente responde con el pitch de SELLKIT
4. Sigue los 5 pasos → al confirmar con "launch" el servicio aparece en la web

### Flujo 2 — Vendedor onboarding via web

1. Abre la web → **Sell your knowledge**
2. Completa los 4 pasos del formulario
3. Conecta wallet en Base mainnet
4. Pulsa **Register & Launch** → confirma 2 transacciones en la wallet (registerSeller + createService)
5. El servicio aparece en la HomePage y en `/dashboard`

### Flujo 3 — Comprador paga via web

1. Abre `/service/:id` de cualquier servicio activo
2. Comprueba el **PaymentSplitPreview** — muestra exactamente cuánto va al vendedor y cuánto de fee
3. Conecta wallet → **Buy for $X.XXXX USDC**
4. Aprueba USDC → el endpoint procesa el pago
5. La transacción aparece en Basescan con el split verificable onchain

---

## 5. Mantenimiento

### Reset mensual del free tier

El agente corre automáticamente el cron `0 0 1 * *` (día 1 de cada mes a medianoche UTC). Si necesitas correrlo manualmente:

```bash
# Desde packages/contracts
npx hardhat run scripts/resetFreeTiers.ts --network base
```

### Actualizar fee global

Desde Basescan → Write Contract → `setGlobalFee` (solo el owner del contrato).
El valor es en basis points: `500` = 5%, `300` = 3%, `1000` = 10%. Máximo `2000` (20%).

### Ver logs del agente

```bash
# En Railway: panel → Deployments → View Logs
# Localmente:
cd packages/agent && npm run dev
```

---

## 6. Variables de entorno — referencia completa

### `.env` local / Railway (agent)

```env
# Contrato
CONTRACT_ADDRESS=                      # tras el deploy
OPERATOR_PRIVATE_KEY=                  # llama processPayment y resetFreeTier
TREASURY_ADDRESS=                      # recibe los fees
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# XMTP
XMTP_WALLET_KEY=                       # wallet del agente
XMTP_DB_ENCRYPTION_KEY=                # 32 bytes hex para la DB local de XMTP
XMTP_ENV=production

# Infraestructura
RPC_URL=https://mainnet-preconf.base.org
BASESCAN_API_KEY=                      # para verificación del contrato
AGENT_BASE_URL=https://TU-APP.railway.app
PORT=3001

# Cron
MONTHLY_RESET_CRON=0 0 1 * *
ERC8004_REGISTRY_ADDRESS=              # opcional — para registro ERC-8004
```

### Vercel (web)

```env
VITE_API_URL=https://TU-APP.railway.app
VITE_CONTRACT_ADDRESS=                 # misma que CONTRACT_ADDRESS
VITE_CHAIN_ID=8453
VITE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
VITE_BASESCAN_URL=https://basescan.org
VITE_WALLETCONNECT_PROJECT_ID=         # opcional
```

### `packages/contracts/.env` (solo para deploy)

```env
DEPLOYER_PRIVATE_KEY=                  # necesita ETH en Base mainnet
BASESCAN_API_KEY=
BASE_RPC_URL=https://mainnet-preconf.base.org
TREASURY_ADDRESS=
INITIAL_FEE_PERCENT=500
FREE_TIER_LIMIT=1000
```

---

## 7. Orden de operaciones (resumen)

```
1. cp .env.example .env  →  rellenar todas las variables excepto CONTRACT_ADDRESS
2. cd packages/contracts && npx hardhat compile
3. npx hardhat run scripts/deploy.ts --network base  →  copiar CONTRACT_ADDRESS
4. Rellenar CONTRACT_ADDRESS y VITE_CONTRACT_ADDRESS en .env
5. npx hardhat run scripts/seed.ts --network base  (opcional)
6. git push  →  Railway despliega el agente automáticamente
7. git push  →  Vercel despliega la web automáticamente
8. Actualizar AGENT_BASE_URL en Railway con la URL final
9. Actualizar VITE_API_URL en Vercel con la URL de Railway
10. Verificar /api/stats y la web
```
