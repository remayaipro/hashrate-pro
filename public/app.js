// =====================================================
// HashRate Pro — Mining Profitability Calculator
// =====================================================

// Coin mining data (rewards per day per unit hashrate, updated periodically)
const COIN_DATA = {
  btc: {
    name: 'Bitcoin',
    symbol: 'BTC',
    algorithm: 'sha256',
    icon: '₿',
    rewardPerBlock: 3.125,
    blockTime: 600,
    // Approximate BTC earned per TH/s per day
    dailyPerThs: 0.0000056
  },
  ltc: {
    name: 'Litecoin',
    symbol: 'LTC',
    algorithm: 'scrypt',
    icon: 'Ł',
    rewardPerBlock: 12.5,
    blockTime: 150,
    dailyPerMhs: 0.000095
  },
  doge: {
    name: 'Dogecoin',
    symbol: 'DOGE',
    algorithm: 'scrypt',
    icon: 'Ð',
    rewardPerBlock: 10000,
    blockTime: 60,
    dailyPerMhs: 0.018
  },
  kas: {
    name: 'Kaspa',
    symbol: 'KAS',
    algorithm: 'kheavyhash',
    icon: 'K',
    rewardPerBlock: 88,
    blockTime: 1,
    dailyPerThs: 4.2
  },
  etc: {
    name: 'Ethereum Classic',
    symbol: 'ETC',
    algorithm: 'etchash',
    icon: 'Ξ',
    rewardPerBlock: 2.56,
    blockTime: 13,
    dailyPerMhs: 0.0022
  },
  xmr: {
    name: 'Monero',
    symbol: 'XMR',
    algorithm: 'randomx',
    icon: 'ɱ',
    rewardPerBlock: 0.6,
    blockTime: 120,
    dailyPerKhs: 0.000028
  },
  rvn: {
    name: 'Ravencoin',
    symbol: 'RVN',
    algorithm: 'kawpow',
    icon: 'R',
    rewardPerBlock: 2500,
    blockTime: 60,
    dailyPerMhs: 0.45
  },
  ergo: {
    name: 'Ergo',
    symbol: 'ERG',
    algorithm: 'autolykos2',
    icon: 'Σ',
    rewardPerBlock: 3,
    blockTime: 120,
    dailyPerMhs: 0.0038
  }
};

// Live prices from CoinGecko (with fallback defaults)
let prices = {
  btc: 66000,
  ltc: 53,
  doge: 0.09,
  kas: 0.035,
  etc: 8.0,
  xmr: 325,
  rvn: 0.0055,
  ergo: 0.28
};
let priceChanges = {
  btc: 0, ltc: 0, doge: 0, kas: 0, etc: 0, xmr: 0, rvn: 0, ergo: 0
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Render immediately with defaults, then try to update
  updateTicker();
  recalculate();
  renderCoinGrid();
  renderHardwareTable();
  
  // Try to fetch live prices
  fetchPrices();
  setInterval(fetchPrices, 60000); // Refresh every minute
});

// ===== PRICE FETCHING =====
async function fetchPrices() {
  try {
    const ids = 'bitcoin,litecoin,dogecoin,kaspa,ethereum-classic,monero,ravencoin,ergo';
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
    );
    const data = await res.json();

    const idMap = {
      bitcoin: 'btc',
      litecoin: 'ltc',
      dogecoin: 'doge',
      kaspa: 'kas',
      'ethereum-classic': 'etc',
      monero: 'xmr',
      ravencoin: 'rvn',
      ergo: 'ergo'
    };

    for (const [geckoId, coinKey] of Object.entries(idMap)) {
      if (data[geckoId]) {
        prices[coinKey] = data[geckoId].usd;
        priceChanges[coinKey] = data[geckoId].usd_24h_change || 0;
      }
    }

    // ETH for reference
    if (data['ethereum-classic']) {
      prices.eth = data['ethereum-classic'].usd;
    }

    updateTicker();
    recalculate();
    renderCoinGrid();
    renderHardwareTable();
  } catch (err) {
    console.error('Price fetch failed:', err);
  }
}

function updateTicker() {
  const ticker = document.getElementById('priceTicker');
  const items = [];

  for (const [key, coin] of Object.entries(COIN_DATA)) {
    if (!prices[key]) continue;
    const change = priceChanges[key] || 0;
    const changeClass = change >= 0 ? 'up' : 'down';
    const changeSign = change >= 0 ? '+' : '';

    items.push(`
      <div class="ticker-item">
        <span class="symbol">${coin.icon} ${coin.symbol}</span>
        <span class="price">$${formatPrice(prices[key])}</span>
        <span class="change ${changeClass}">${changeSign}${change.toFixed(2)}%</span>
      </div>
    `);
  }

  // Duplicate for seamless scroll
  ticker.innerHTML = items.join('') + items.join('');
}

// ===== CALCULATOR LOGIC =====
let currentMethod = 'gpu';

function setMethod(method) {
  currentMethod = method;
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });
  document.getElementById('gpuSection').style.display = method === 'gpu' ? 'block' : 'none';
  document.getElementById('asicSection').style.display = method === 'asic' ? 'block' : 'none';
  recalculate();
}

function updateHashrate() {
  recalculate();
}

function recalculate() {
  const coin = document.getElementById('coinSelect').value;
  const elecRate = parseFloat(document.getElementById('electricityCost').value) || 0.12;
  const poolFee = parseFloat(document.getElementById('poolFee')?.value) || 1;
  const coinData = COIN_DATA[coin];
  const coinPrice = prices[coin] || 0;

  let hashrate = 0; // In the coin's native unit
  let powerWatts = 0;

  // Custom override
  const customHash = parseFloat(document.getElementById('customHashrate')?.value);
  const customPower = parseFloat(document.getElementById('customPower')?.value);

  if (currentMethod === 'gpu') {
    const select = document.getElementById('gpuSelect');
    const option = select.options[select.selectedIndex];
    const gpuCount = parseInt(document.getElementById('gpuCount').value) || 1;

    if (option && option.dataset.hashrate) {
      hashrate = parseFloat(option.dataset.hashrate) * gpuCount;
      powerWatts = parseFloat(option.dataset.power) * gpuCount;
    }
  } else {
    const select = document.getElementById('asicSelect');
    const option = select.options[select.selectedIndex];

    if (option && option.dataset.hashrate) {
      hashrate = parseFloat(option.dataset.hashrate);
      powerWatts = parseFloat(option.dataset.power);
    }
  }

  // Apply custom overrides
  if (customHash) hashrate = customHash;
  if (customPower) powerWatts = customPower;

  // Calculate earnings
  let dailyCoins = 0;
  const isAsic = currentMethod === 'asic';

  // If no hashrate selected, show zeros
  if (hashrate <= 0 || !coinData) {
    setResults(0, 0, coin, COIN_DATA[coin]?.symbol || '???');
    return;
  }

  // Determine the unit of hashrate from the selected option
  let hashUnit = 'mhs'; // default for GPU
  if (isAsic) {
    const select = document.getElementById('asicSelect');
    const opt = select.options[select.selectedIndex];
    if (opt && opt.dataset.algo) {
      if (opt.dataset.algo === 'sha256' || opt.dataset.algo === 'kheavyhash') {
        hashUnit = 'ths';
      } else if (opt.dataset.algo === 'scrypt') {
        hashUnit = 'ghs';
      }
    }
  }

  if (coin === 'btc' && hashUnit === 'ths') {
    // ASIC on SHA256 - hashrate is in TH/s
    dailyCoins = hashrate * coinData.dailyPerThs;
  } else if (coin === 'kas' && hashUnit === 'ths') {
    // ASIC on kHeavyHash - hashrate is in TH/s
    dailyCoins = hashrate * coinData.dailyPerThs;
  } else if ((coin === 'ltc' || coin === 'doge') && hashUnit === 'ghs') {
    // ASIC Scrypt - hashrate is in GH/s, convert to MH/s (x1000)
    dailyCoins = hashrate * 1000 * coinData.dailyPerMhs;
  } else if (coin === 'xmr') {
    // kH/s based (CPU mining)
    dailyCoins = hashrate * coinData.dailyPerKhs;
  } else {
    // MH/s based (GPU)
    dailyCoins = hashrate * coinData.dailyPerMhs;
  }

  // Apply pool fee
  if (isNaN(dailyCoins)) dailyCoins = 0;
  dailyCoins *= (1 - poolFee / 100);

  const dailyRevenue = (isNaN(dailyCoins) ? 0 : dailyCoins) * coinPrice;
  const dailyPowerCost = (isNaN(powerWatts) ? 0 : (powerWatts / 1000)) * 24 * elecRate;

  // Update UI
  setResults(dailyRevenue, dailyPowerCost, coin, COIN_DATA[coin].symbol);
}

// ===== HARDWARE TABLE =====
function renderHardwareTable() {
  const tbody = document.getElementById('hardwareBody');
  const elecRate = parseFloat(document.getElementById('electricityCost').value) || 0.12;

  const miners = [
    { name: 'Antminer S21 XP', hashrate: '270 TH/s', power: 3645, dailyRev: 0, algo: 'SHA256', price: '$8,500-12,000' },
    { name: 'Antminer S21 Pro', hashrate: '234 TH/s', power: 3510, dailyRev: 0, algo: 'SHA256', price: '$5,500-8,000' },
    { name: 'WhatsMiner M66S', hashrate: '298 TH/s', power: 5580, dailyRev: 0, algo: 'SHA256', price: '$9,000-14,000' },
    { name: 'Antminer L9 (DOGE/LTC)', hashrate: '17 GH/s', power: 3570, dailyRev: 0, algo: 'Scrypt', price: '$6,000-9,000' },
    { name: 'RTX 4090', hashrate: '130 MH/s', power: 350, dailyRev: 0, algo: 'Various', price: '$1,600-2,000' },
    { name: 'RTX 4080', hashrate: '100 MH/s', power: 300, dailyRev: 0, algo: 'Various', price: '$1,000-1,300' },
    { name: 'RTX 4070', hashrate: '60 MH/s', power: 220, dailyRev: 0, algo: 'Various', price: '$550-700' },
    { name: 'RTX 3060 Ti', hashrate: '60 MH/s', power: 200, dailyRev: 0, algo: 'Various', price: '$280-400' },
    { name: 'RX 7900 XTX', hashrate: '115 MH/s', power: 355, dailyRev: 0, algo: 'Various', price: '$800-1,000' },
  ];

  // Calculate daily profit for each (using BTC as reference for ASICs, ETC for GPUs)
  miners.forEach(m => {
    const dailyPower = (m.power / 1000) * 24 * elecRate;
    let dailyRevenue = 0;

    if (m.algo === 'SHA256') {
      const ths = parseFloat(m.hashrate);
      dailyRevenue = ths * COIN_DATA.btc.dailyPerThs * (prices.btc || 66000);
    } else if (m.algo === 'Scrypt') {
      // L9: 17 GH/s. For LTC+DOGE merged mining, use DOGE as primary
      const ghs = parseFloat(m.hashrate);
      const mhs = ghs * 1000; // 17000 MH/s
      // DOGE is the primary profit driver for merged mining
      dailyRevenue = mhs * COIN_DATA.doge.dailyPerMhs * (prices.doge || 0.09);
    } else {
      // GPU - use ETC as baseline
      const mhs = parseFloat(m.hashrate);
      dailyRevenue = mhs * COIN_DATA.etc.dailyPerMhs * (prices.etc || 25);
    }

    m.dailyProfit = dailyRevenue - dailyPower;
  });

  tbody.innerHTML = miners.map(m => `
    <tr>
      <td><strong>${m.name}</strong></td>
      <td>${m.hashrate}</td>
      <td>${m.power}W</td>
      <td>${m.algo}</td>
      <td class="${m.dailyProfit >= 0 ? 'profit-positive' : 'profit-negative'}">
        ${m.dailyProfit >= 0 ? '+' : ''}$${m.dailyProfit.toFixed(2)}/day
      </td>
      <td>${m.price}</td>
    </tr>
  `).join('');
}

// ===== COIN GRID =====
function renderCoinGrid() {
  const grid = document.getElementById('coinGrid');

  grid.innerHTML = Object.entries(COIN_DATA).map(([key, coin]) => {
    const price = prices[key] || 0;
    const change = priceChanges[key] || 0;
    const changeClass = change >= 0 ? 'up' : 'down';
    const changeSign = change >= 0 ? '+' : '';

    return `
      <div class="coin-card">
        <div class="coin-header">
          <div class="coin-icon">${coin.icon}</div>
          <div>
            <div class="coin-name">${coin.name}</div>
            <div class="coin-symbol">${coin.symbol}</div>
          </div>
          <span class="mineable-badge">Mineable</span>
        </div>
        <div class="coin-stats">
          <div class="coin-stat">
            <div class="coin-stat-label">Price</div>
            <div class="coin-stat-value">$${formatPrice(price)}</div>
          </div>
          <div class="coin-stat">
            <div class="coin-stat-label">24h Change</div>
            <div class="coin-stat-value" style="color: ${change >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
              ${changeSign}${change.toFixed(2)}%
            </div>
          </div>
          <div class="coin-stat">
            <div class="coin-stat-label">Algorithm</div>
            <div class="coin-stat-value">${coin.algorithm}</div>
          </div>
          <div class="coin-stat">
            <div class="coin-stat-label">Block Reward</div>
            <div class="coin-stat-value">${coin.rewardPerBlock} ${coin.symbol}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== RESULTS DISPLAY =====
function setResults(dailyRevenue, dailyPowerCost, coin, symbol) {
  // Guard against NaN
  dailyRevenue = isNaN(dailyRevenue) ? 0 : dailyRevenue;
  dailyPowerCost = isNaN(dailyPowerCost) ? 0 : dailyPowerCost;

  const dailyProfit = dailyRevenue - dailyPowerCost;
  const monthlyProfit = dailyProfit * 30;
  const yearlyProfit = dailyProfit * 365;

  const profitEl = document.getElementById('dailyProfit');
  const profitValue = profitEl.querySelector('.profit-value');
  profitValue.textContent = `$${dailyProfit.toFixed(2)}`;
  profitValue.className = `profit-value ${dailyProfit >= 0 ? 'positive' : 'negative'}`;

  document.getElementById('dailyRevenue').textContent = `$${dailyRevenue.toFixed(2)}`;
  document.getElementById('dailyElec').textContent = `$${dailyPowerCost.toFixed(2)}`;
  document.getElementById('monthlyProfit').textContent = `$${monthlyProfit.toFixed(2)}`;
  document.getElementById('yearlyProfit').textContent = `$${yearlyProfit.toFixed(2)}`;

  const dailyCoins = dailyRevenue / (prices[coin] || 1);
  let coinsDisplay;
  if (dailyCoins === 0 || isNaN(dailyCoins)) {
    coinsDisplay = '0';
  } else if (dailyCoins < 0.00001) {
    coinsDisplay = dailyCoins.toExponential(2);
  } else if (dailyCoins < 1) {
    coinsDisplay = dailyCoins.toFixed(6);
  } else {
    coinsDisplay = dailyCoins.toFixed(2);
  }
  document.getElementById('coinsPerDay').textContent = `${coinsDisplay} ${symbol}`;

  if (dailyProfit > 0) {
    const breakEvenDays = Math.ceil(1000 / dailyProfit);
    document.getElementById('breakEven').textContent = `${breakEvenDays} days`;
  } else {
    document.getElementById('breakEven').textContent = 'Not profitable';
  }

  const total = dailyRevenue + dailyPowerCost;
  if (total > 0) {
    document.getElementById('barRevenue').style.width = `${(dailyRevenue / total) * 100}%`;
    document.getElementById('barCost').style.width = `${(dailyPowerCost / total) * 100}%`;
  } else {
    document.getElementById('barRevenue').style.width = '50%';
    document.getElementById('barCost').style.width = '50%';
  }
}

// ===== HELPERS =====
function formatPrice(price) {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}
