// Purchasing does not change the account's administrative privileges.
export const canPurchase=user=>['customer','admin','super_admin'].includes(user?.role);
