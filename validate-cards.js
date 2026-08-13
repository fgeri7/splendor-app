// Splendor base-game card data validator.
// Run this in the browser console while the app is open.
// Expected base-game structure: 40 / 30 / 20 = 90 cards.

(function validateSplendorCards() {
  const expectedTiers = {1: 40, 2: 30, 3: 20};
  const colors = ["black", "white", "red", "blue", "green"];
  const errors = [];
  const ids = new Set();

  if (!Array.isArray(CARD_DATA)) {
    errors.push("CARD_DATA is not an array.");
  } else {
    for (const c of CARD_DATA) {
      if (ids.has(c.id)) errors.push(`Duplicate ID: ${c.id}`);
      ids.add(c.id);

      if (!expectedTiers[c.tier])
        errors.push(`Invalid tier: ${c.id}`);

      if (!colors.includes(c.bonus))
        errors.push(`Invalid bonus color: ${c.id}`);

      if (!Number.isInteger(c.points) || c.points < 0)
        errors.push(`Invalid points: ${c.id}`);

      if (!c.cost ||
          colors.some(color =>
            !Number.isInteger(c.cost[color]) ||
            c.cost[color] < 0
          )) {
        errors.push(`Invalid cost data: ${c.id}`);
      }
    }
  }

  const tiers = Object.fromEntries(
    [1, 2, 3].map(t => [
      t,
      Array.isArray(CARD_DATA)
        ? CARD_DATA.filter(c => c.tier === t).length
        : 0
    ])
  );

  const bonusDistribution = Object.fromEntries(
    colors.map(color => [
      color,
      Array.isArray(CARD_DATA)
        ? CARD_DATA.filter(c => c.bonus === color).length
        : 0
    ])
  );

  for (const tier of [1, 2, 3]) {
    if (tiers[tier] !== expectedTiers[tier]) {
      errors.push(
        `Tier ${tier}: ${tiers[tier]}, expected ${expectedTiers[tier]}`
      );
    }
  }

  if (!Array.isArray(CARD_DATA) || CARD_DATA.length !== 90) {
    errors.push(
      `Total: ${CARD_DATA?.length ?? 0}, expected 90`
    );
  }

  if (Object.values(bonusDistribution).some(n => n !== 18)) {
    errors.push(
      `Bonus distribution: ${JSON.stringify(bonusDistribution)}, expected 18 each.`
    );
  }

  const result = {
    total: CARD_DATA?.length ?? 0,
    tiers,
    bonusDistribution,
    errors
  };

  console.table(tiers);
  console.table(bonusDistribution);

  console.log(
    `Splendor card validation: ${errors.length ? "FAILED" : "OK"}`,
    result
  );

  return result;
})(); 
