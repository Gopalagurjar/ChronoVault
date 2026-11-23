const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isEmail = (s) => typeof s === 'string' && s.length <= 254 && EMAIL.test(s.trim());
const isStr = (s, min = 1, max = 200) => typeof s === 'string' && s.trim().length >= min && s.trim().length <= max;
module.exports = { isEmail, isStr };
