// Mock LLM — activates when GROQ_API_KEY is not set.
// Pattern-matches the visitor's question against the knowledge base content
// in the system prompt and returns a relevant answer. Falls back to email-capture.

export const GROQ_DEFAULTS = Object.freeze({ model: 'mock', temperature: 0.3, max_tokens: 300, top_p: 0.9 });

function polish(s) {
  if (!s) return s;
  s = s.replace(/(^|[.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
  s = s.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, m => m[0].toUpperCase() + m.slice(1).toLowerCase());
  s = s.replace(/\b(sourdough|croissant|croissants|baguette|muffins|donuts|pastries|espresso|cappuccino|latte|vegan|gluten-free|sourdough loaf|butter croissants|birthday cake|custom cake)\b/gi, m => m[0].toUpperCase() + m.slice(1).toLowerCase());
  s = s.replace(/\b(am|pm)\b/gi, m => m.toUpperCase());
  s = s.replace(/sunrise bakery/gi, 'Sunrise Bakery');
  s = s.replace(/^Our hours: /m, 'Our hours are ');
  return s;
}

export async function chatCompletion(opts = {}) {
  const system = opts.system || '';
  const user = (opts.user || '').toLowerCase().trim();

  // Extract the knowledge base from the system prompt.
  const kbMatch = system.match(/BUSINESS KNOWLEDGE BASE:\n([\s\S]*?)\n\nBUSINESS NAME:/);
  const kb = kbMatch ? kbMatch[1].toLowerCase() : '';
  const nameMatch = system.match(/BUSINESS NAME: (.+)/);
  const bizName = nameMatch ? nameMatch[1].trim() : 'this business';

  // Greetings.
  if (/^(hi|hello|hey|halo|howdy|good (morning|afternoon|evening))/.test(user)) {
    return { reply: polish(`Hi there! Welcome to ${bizName}. How can I help you today?` };
  }

  // Hours.
  if (user.includes('hour') || user.includes('open') || user.includes('close') || user.includes('when')) {
    const hoursLine = kb.match(/hours?:?([^\n]+)/i);
    if (hoursLine) return { reply: polish(`Our hours: ${hoursLine[1].trim()}. Come visit us!` };
  }

  // Price / cost.
  if (user.includes('price') || user.includes('cost') || user.includes('how much') || user.includes('expensive')) {
    const priceLines = kb.split('\n').filter(l => /\$|price|cost|fee/i.test(l));
    if (priceLines.length) return { reply: priceLines.slice(0, 3).join('\n').trim() };
  }

  // Delivery / shipping.
  if (user.includes('deliver') || user.includes('ship') || user.includes('shipping')) {
    const delLine = kb.split('\n').find(l => /deliver|ship/i.test(l));
    if (delLine) return { reply: delLine.trim() };
  }

  // Location / address / where.
  if (user.includes('where') || user.includes('location') || user.includes('address') || user.includes('find you')) {
    const locLine = kb.split('\n').find(l => /location|address|street|road|avenue/i.test(l));
    if (locLine) return { reply: locLine.trim() };
  }

  // Phone / contact.
  if (user.includes('phone') || user.includes('call') || user.includes('contact') || user.includes('number')) {
    const phoneLine = kb.split('\n').find(l => /phone|call|contact/i.test(l));
    if (phoneLine) return { reply: phoneLine.trim() };
  }

  // Menu / products / what do you sell.
  if (user.includes('menu') || user.includes('sell') || user.includes('product') || user.includes('what do you')) {
    const menuLine = kb.split('\n').find(l => /menu|product|sell|offer/i.test(l));
    if (menuLine) return { reply: menuLine.trim() };
  }

  // Allergens / dietary.
  if (user.includes('allerg') || user.includes('gluten') || user.includes('vegan') || user.includes('dairy') || user.includes('nut')) {
    const algLine = kb.split('\n').find(l => /allerg|gluten|vegan|dairy|nut/i.test(l));
    if (algLine) return { reply: algLine.trim() };
  }

  // Order / how to buy.
  if (user.includes('order') || user.includes('buy') || user.includes('purchase')) {
    const orderLine = kb.split('\n').find(l => /order|buy|purchase/i.test(l));
    if (orderLine) return { reply: orderLine.trim() };
  }

  // Payment.
  if (user.includes('pay') || user.includes('card') || user.includes('cash') || user.includes('apple pay')) {
    const payLine = kb.split('\n').find(l => /payment|pay|card|cash/i.test(l));
    if (payLine) return { reply: payLine.trim() };
  }

  // Loyalty / rewards.
  if (user.includes('loyalt') || user.includes('reward') || user.includes('stamp') || user.includes('free')) {
    const loyalLine = kb.split('\n').find(l => /loyalt|reward|stamp|free/i.test(l));
    if (loyalLine) return { reply: loyalLine.trim() };
  }

  // Generic keyword search: find the line in KB with the most matching words.
  const userWords = user.split(/\s+/).filter(w => w.length > 3);
  let bestLine = null, bestScore = 0;
  for (const line of kb.split('\n')) {
    const lineWords = line.toLowerCase();
    let score = 0;
    for (const w of userWords) if (lineWords.includes(w)) score++;
    if (score > bestScore) { bestScore = score; bestLine = line; }
  }
  if (bestScore >= 2 && bestLine) return { reply: bestLine.trim() };

  // Fallback: email capture (per spec §7.3).
  return {
    reply: "I'm not sure about that one — could you leave your email so our team can follow up with you?"
  };
}

export async function listModels() { return { data: [{ id: 'mock' }] }; }
