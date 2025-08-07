# F&B Restocking Workflow - APK Billing System

## 🛒 Complete Guide: From Shopping to Stock Management

### Phase 1: Before Shopping (Preparation)

#### 1. Check Current Stock Levels
- Go to **POS System** → View products and their current stock levels
- Or go to **Stock Movements** → Filter by product to see stock history
- Identify products with low stock that need restocking

#### 2. Review Supplier Information
- Go to **Suppliers** → View all available suppliers
- Check supplier contact details and notes
- Add new suppliers if needed using "Add Supplier" button

### Phase 2: Shopping & Purchase Orders

#### 3. Create Purchase Order (BEFORE Shopping)
- Go to **Purchase Orders** → Click "Create Purchase Order"
- Select supplier (e.g., "Toko Grosir Sejahtera")
- Set purchase date
- Add items to purchase:
  - Select product from dropdown (shows current stock level)
  - Enter quantity to purchase
  - Enter unit price from supplier
  - Click "Add Item" to add to order
- Review total amount
- Click "Create Purchase Order"
- **Take note of PO Number** (e.g., PO25010820241234)

#### 4. Physical Shopping
- Use the Purchase Order as your shopping list
- Buy items according to your PO
- Keep all receipts and invoices from suppliers

### Phase 3: After Shopping (Stock Receiving)

#### 5. Receive Purchase Order
- Go to **Purchase Orders** → Find your PO (status should be "pending")
- Click the **green receive button** (✓) next to your PO
- Review items to be received
- Click "Confirm Receive"
- System will automatically:
  - Update all product stock quantities
  - Record stock movements for each item
  - Mark PO as "received"
  - Log who received the order and when

#### 6. Verify Stock Updates
- Go to **POS System** → Check that product stock levels have increased
- Go to **Stock Movements** → View recent "purchase" movements
- Verify all quantities match what you actually received

### Phase 4: Ongoing Management

#### 7. Monitor Stock Movements
- Go to **Stock Movements** to track all inventory changes:
  - **Purchase** movements (green) = Stock added from suppliers
  - **Sale** movements (blue) = Stock reduced from customer orders
  - **Adjustment** movements (orange) = Manual stock corrections
  - **Waste** movements (red) = Stock removed due to spoilage/damage

#### 8. Track Purchase History
- Go to **Purchase Orders** to view:
  - All past purchases with dates and amounts
  - Supplier performance history
  - Total spending per supplier
  - Purchase patterns and trends

#### 9. Generate Reports
- Go to **Reports** → **Financial Summary** to see:
  - Total purchase expenses
  - Revenue vs. purchase costs
  - Profit margins
- Use date filters to analyze specific periods

### 📋 Quick Reference Checklist

**Before Shopping:**
- [ ] Check current stock levels
- [ ] Identify items to restock
- [ ] Verify supplier information

**Create Purchase Order:**
- [ ] Select correct supplier
- [ ] Add all items with quantities and prices
- [ ] Review total amount
- [ ] Save PO number for reference

**After Shopping:**
- [ ] Go to Purchase Orders
- [ ] Find your pending PO
- [ ] Click "Receive Order"
- [ ] Confirm all items received
- [ ] Verify stock levels updated

**Verify & Monitor:**
- [ ] Check POS System stock levels
- [ ] Review Stock Movements for accuracy
- [ ] Monitor purchase history in reports

### 🔧 System Features

**Supplier Management:**
- Add/edit supplier contact information
- Track supplier performance
- Activate/deactivate suppliers
- Store notes and addresses

**Purchase Orders:**
- Auto-generated PO numbers
- Multi-item orders with calculations
- Status tracking (pending/received/cancelled)
- User attribution (who created/received)

**Stock Management:**
- Automatic stock updates upon receiving
- Real-time stock levels in POS
- Complete movement history
- Prevents negative stock

**Reporting:**
- Purchase expense tracking
- Stock movement analysis
- Supplier spending reports
- Financial summaries with date filtering

### ⚠️ Important Notes

1. **Always create PO before shopping** - This ensures proper expense tracking
2. **Receive orders promptly** - Stock levels won't update until PO is received
3. **Verify quantities** - Check that received quantities match what you bought
4. **Keep supplier receipts** - For reconciliation and warranty purposes
5. **Monitor stock regularly** - Set up regular stock checks to avoid stockouts

### 💡 Pro Tips

- Use the search feature in POS System to quickly find products
- Sort products by stock quantity to identify low stock items
- Use supplier notes to record special terms or contact preferences
- Export reports to CSV for external analysis
- Set up regular restocking schedules based on sales patterns

### 🆘 Troubleshooting

**Stock not updating after receiving PO:**
- Check that PO status changed to "received"
- Verify all items were added correctly to the PO
- Check Stock Movements for purchase entries

**Can't find product in Purchase Order:**
- Product may not exist in system yet
- Contact admin to add new products
- Check product is active in POS System

**Supplier information missing:**
- Go to Suppliers → Add or edit supplier details
- Ensure supplier is marked as "Active"

### 📊 Reports Available

1. **Purchase Orders Report** - All purchases by date range
2. **Stock Movements Report** - All inventory changes
3. **Supplier Performance** - Spending by supplier
4. **Financial Summary** - Purchase costs vs. revenue
5. **Low Stock Alert** - Items needing restock (coming soon)

This system ensures complete traceability from purchase to sale, helping you manage F&B inventory efficiently and maintain accurate financial records.