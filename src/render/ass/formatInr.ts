// "₹1,200" style Indian grouping used by every on-screen price.
export const formatInr = (amount: number): string => {
  try {
    return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
  } catch (error: any) {
    console.error('[formatInr] Error:', error?.response?.data || error?.message || error);
    return `₹${amount}`;
  }
};
