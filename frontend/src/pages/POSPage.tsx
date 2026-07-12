import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, ChevronDown,
  CreditCard, Banknote, FileText, Check, Printer, Tag, User, Users, Coins, Receipt
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatNumber } from '../utils/formatters';
import toast from 'react-hot-toast';
import ReceiptPrint from '../components/pos/ReceiptPrint';

interface Product {
  id: number;
  name: string;
  name_ar: string;
  selling_price: number;
  cost_price: number;
  product_type: 'stock_tracked' | 'non_stock';
  category_id: number;
  category_name: string;
  category_color: string;
  current_stock: number;
  min_stock_alert: number;
  unit: string;
  image_url?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Category {
  id: number;
  name: string;
  color: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  balance: number;
}

const POSPage: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mixed' | 'debt'>('cash');
  const [mixedCashAmount, setMixedCashAmount] = useState<string>('');
  const [mixedCardAmount, setMixedCardAmount] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);

  // Previous Invoices State
  const [showRecentSalesModal, setShowRecentSalesModal] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loadingRecentSales, setLoadingRecentSales] = useState(false);
  const [viewedSale, setViewedSale] = useState<any>(null);
  const [showViewedReceipt, setShowViewedReceipt] = useState(false);

  const printReceipt = () => {
    // With --kiosk-printing and --disable-print-preview flags in main.js,
    // window.print() becomes the most reliable and foolproof silent method.
    window.print();
  };

  const handleOpenRecentSales = async () => {
    setShowRecentSalesModal(true);
    setLoadingRecentSales(true);
    try {
      const res = await api.get('/sales', { params: { limit: 10 } });
      setRecentSales(res.data.data);
    } catch (err) {
      toast.error('خطأ في جلب الفواتير السابقة');
    } finally {
      setLoadingRecentSales(false);
    }
  };

  const handleViewPreviousSale = async (id: number) => {
    try {
      const res = await api.get(`/sales/${id}`);
      setViewedSale(res.data.data);
      setShowViewedReceipt(true);
      setShowRecentSalesModal(false);
    } catch (err) {
      toast.error('خطأ في جلب الفاتورة');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto print: fires after DOM updates with the completed sale data
  useEffect(() => {
    if (completedSale && autoPrint) {
      const timer = setTimeout(() => {
        printReceipt();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [completedSale, autoPrint]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, catRes, customerRes] = await Promise.all([
        api.get('/products', { params: { is_active: 'true', show_in_pos: 'true' } }),
        api.get('/categories', { params: { active_only: 'true' } }),
        api.get('/customers', { params: { is_active: 'true' } })
      ]);
      const availableProducts = productsRes.data.data;
      setProducts(availableProducts);
      setCategories(catRes.data.data);
      setCustomers(customerRes.data.data);

      // Restore edit session if exists
      const editSessionStr = localStorage.getItem('editCartSession');
      if (editSessionStr) {
        try {
          const session = JSON.parse(editSessionStr);
          const restoredCart = session.items.map((item: any) => {
            const prod = availableProducts.find((p: any) => p.id === item.product_id) || {
              id: item.product_id,
              name: item.product_name,
              product_type: item.product_type,
              current_stock: 9999,
              selling_price: item.unit_price,
            };
            return {
              product: prod,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.total
            };
          });
          setCart(restoredCart);
          if (session.discount_percent !== undefined) setDiscountPercent(session.discount_percent);
          if (session.notes) setNotes(session.notes);
          if (session.payment_method) setPaymentMethod(session.payment_method);
        } catch(e) {
          console.error('Error parsing edit session', e);
        } finally {
          localStorage.removeItem('editCartSession');
        }
      }
    } catch (err) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.name_ar.includes(search);
    const matchesCategory = activeCategory === null || p.category_id === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Cart operations
  const addToCart = (product: Product) => {
    // Check stock
    if (product.product_type === 'stock_tracked' && product.current_stock <= 0) {
      toast.error(`${product.name} - نفد المخزون`);
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      if (product.product_type === 'stock_tracked' && existing.quantity >= product.current_stock) {
        toast.error(`الكمية المطلوبة تتجاوز المخزون (${formatNumber(product.current_stock)} ${product.unit})`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex] = {
        ...existing,
        quantity: existing.quantity + 1,
        total: (existing.quantity + 1) * existing.unit_price
      };
      setCart(updated);
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        unit_price: product.selling_price,
        total: product.selling_price
      }]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const item = cart[index];
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    if (item.product.product_type === 'stock_tracked' && newQty > item.product.current_stock) {
      toast.error(`الكمية المتوفرة: ${formatNumber(item.product.current_stock)} ${item.product.unit}`);
      return;
    }
    const updated = [...cart];
    updated[index] = { ...item, quantity: newQty, total: newQty * item.unit_price };
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setNotes('');
    setSelectedCustomer(null);
    setViewedSale(null);
    setMixedCashAmount('');
    setMixedCardAmount('');
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const total = subtotal - discountAmount;

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.error('الرجاء إضافة منتجات إلى السلة');
      return;
    }

    if (paymentMethod === 'debt' && !selectedCustomer) {
      toast.error('يجب اختيار عميل للبيع بالدين');
      return;
    }

    try {
      setProcessing(true);
      const res = await api.post('/sales', {
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        payment_method: paymentMethod,
        customer_id: selectedCustomer?.id || null,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        notes: notes || null,
        cash_amount: paymentMethod === 'cash' ? total : paymentMethod === 'mixed' ? (parseFloat(mixedCashAmount) || 0) : 0,
        card_amount: paymentMethod === 'card' ? total : paymentMethod === 'mixed' ? (selectedCustomer ? (parseFloat(mixedCardAmount) || 0) : Math.max(0, total - (parseFloat(mixedCashAmount) || 0))) : 0,
        debt_amount: paymentMethod === 'debt' ? total : paymentMethod === 'mixed' ? (selectedCustomer ? Math.max(0, total - ((parseFloat(mixedCashAmount) || 0) + (parseFloat(mixedCardAmount) || 0))) : 0) : 0,
      });

      setCompletedSale(res.data.data);
      setShowViewedReceipt(false); // Reset viewed receipt if any

      if (!autoPrint) {
        setShowReceipt(true);
      }

      toast.success(`تم إنشاء الفاتورة: ${res.data.data.invoice_number}`);

      // Refresh data
      fetchData();
      clearCart();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في إنشاء الفاتورة');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintPreliminary = () => {
    if (cart.length === 0) {
      toast.error('السلة فارغة');
      return;
    }

    const mockSale = {
      invoice_number: 'طلب مبدئي',
      created_at: new Date().toISOString(),
      items: cart.map(item => ({
        product_name: item.product.name,
        quantity: item.quantity,
        total: item.total,
        unit_price: item.unit_price,
      })),
      subtotal,
      discount_amount: discountAmount,
      total,
      payment_method: paymentMethod,
      notes: notes,
      cashier_name: user?.full_name || ''
    };

    setViewedSale(mockSale);
    // Print logic immediately
    setTimeout(() => {
      printReceipt();
    }, 150);
  };

  return (
    <>
      <div className="flex h-screen bg-stone-50 pos-ui-container" dir="rtl">
        {/* Products Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* POS Header */}
          <div className="bg-white border-b border-stone-100 p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث عن منتج..."
                  className="input pr-10 text-base py-3"
                />
              </div>
              <button
                onClick={handleOpenRecentSales}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border font-bold transition-all bg-white hover:bg-stone-50 border-stone-200 text-stone-700 whitespace-nowrap shadow-sm"
              >
                <FileText className="w-5 h-5 text-coffee-600" />
                <span className="hidden sm:inline">الفواتير السابقة</span>
              </button>
              <button
                onClick={() => setAutoPrint(!autoPrint)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border font-bold transition-all shadow-sm ${autoPrint
                    ? 'bg-coffee-50 border-coffee-200 text-coffee-700'
                    : 'bg-stone-50 border-stone-200 text-stone-500'
                  }`}
              >
                <Printer className="w-5 h-5" />
                <span className="hidden sm:inline">الطباعة التلقائية</span>
                <span className={`text-sm px-2 py-0.5 rounded-lg font-extrabold ${autoPrint ? 'bg-coffee-200 text-coffee-800' : 'bg-stone-200 text-stone-600'}`}>
                  {autoPrint ? 'مفعل' : 'معطل'}
                </span>
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hidden">
              <button
                onClick={() => setActiveCategory(null)}
                className={`pos-category-tab ${activeCategory === null ? 'active' : ''}`}
              >
                الكل
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className={`pos-category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                  style={activeCategory === cat.id ? { backgroundColor: cat.color } : {}}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-40 skeleton rounded-2xl" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-stone-400">
                <Search className="w-16 h-16 mb-3" />
                <p className="font-bold text-lg">لا توجد منتجات</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => {
                  const isOutOfStock = product.product_type === 'stock_tracked' && product.current_stock <= 0;
                  return (
                    <motion.button
                      key={product.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={`pos-product-card group !p-0 overflow-hidden text-right flex flex-col ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {/* Large image banner */}
                      <div className="relative w-full aspect-square bg-stone-100">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ backgroundColor: product.category_color + '20' }}
                          >
                            <div className="w-12 h-12 rounded-full" style={{ backgroundColor: product.category_color }}></div>
                          </div>
                        )}
                        {product.product_type === 'stock_tracked' && (
                          <span className={`absolute top-2 right-2 text-sm font-bold px-2 py-1 rounded-lg shadow-sm ${isOutOfStock ? 'bg-red-100 text-red-600' :
                              product.current_stock <= product.min_stock_alert ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                            }`}>
                            {isOutOfStock ? 'نفد' : formatNumber(product.current_stock)}
                          </span>
                        )}
                        {!isOutOfStock && (
                          <div className="absolute top-2 left-2 w-9 h-9 bg-coffee-600 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                            <Plus className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                      {/* Name + price */}
                      <div className="w-full p-3 flex flex-col">
                        <p className="text-base font-bold text-stone-800 line-clamp-2 leading-tight min-h-[2.5rem]">{product.name}</p>
                        <p className="text-coffee-600 font-extrabold text-2xl mt-1">{formatCurrency(product.selling_price)}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="w-80 xl:w-96 bg-white border-r border-stone-100 flex flex-col shadow-sidebar">
          {/* Cart Header */}
          <div className="p-4 border-b border-stone-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-coffee-600" />
                <h2 className="font-bold text-stone-900">السلة</h2>
                {cart.length > 0 && (
                  <span className="badge badge-coffee">{cart.length}</span>
                )}
              </div>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1">
                  <Trash2 className="w-4 h-4" />
                  مسح
                </button>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <AnimatePresence>
              {cart.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-48 text-stone-300"
                >
                  <ShoppingCart className="w-12 h-12 mb-2" />
                  <p className="text-sm">اضغط على منتج لإضافته</p>
                </motion.div>
              ) : (
                cart.map((item, index) => (
                  <motion.div
                    key={`${item.product.id}-${index}`}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    className="bg-stone-50 rounded-xl p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-stone-800 line-clamp-1">{item.product.name}</p>
                        <p className="text-sm text-stone-500 font-medium">{formatCurrency(item.unit_price)} / وحدة</p>
                      </div>
                      <button onClick={() => removeFromCart(index)} className="text-red-400 hover:text-red-600 flex-shrink-0 p-1">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(index, -1)}
                          className="w-9 h-9 bg-white rounded-xl border border-stone-200 flex items-center justify-center hover:bg-stone-50 transition-colors"
                        >
                          <Minus className="w-4 h-4 text-stone-600" />
                        </button>
                        <span className="w-10 text-center text-base font-bold text-stone-800">{formatNumber(item.quantity)}</span>
                        <button
                          onClick={() => updateQuantity(index, 1)}
                          className="w-9 h-9 bg-coffee-600 rounded-xl flex items-center justify-center hover:bg-coffee-700 transition-colors"
                        >
                          <Plus className="w-4 h-4 text-white" />
                        </button>
                      </div>
                      <span className="font-extrabold text-stone-900 text-lg">{formatCurrency(item.total)}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Cart Footer */}
          <div className="p-4 border-t border-stone-100 space-y-3">
            {/* Customer Selection */}
            <div className="relative">
              <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${selectedCustomer ? 'bg-coffee-50 border-coffee-200' : 'bg-stone-50 border-stone-200'
                }`}>
                <User className={`w-5 h-5 ${selectedCustomer ? 'text-coffee-600' : 'text-stone-400'}`} />
                {selectedCustomer ? (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-coffee-900 truncate">{selectedCustomer.name}</p>
                    <p className="text-[10px] text-coffee-600 font-bold">الحساب: {formatCurrency(selectedCustomer.balance)}</p>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={customerSearch}
                    onFocus={() => setShowCustomerResults(true)}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerResults(true);
                    }}
                    placeholder="ابحث عن عميل (اختياري)..."
                    className="bg-transparent border-none focus:ring-0 text-sm flex-1 p-0"
                  />
                )}
                {selectedCustomer ? (
                  <button onClick={() => setSelectedCustomer(null)} className="text-stone-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-400" />
                )}
              </div>

              {/* Customer Search Dropdown */}
              {showCustomerResults && !selectedCustomer && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-stone-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                  {customers
                    .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone && c.phone.includes(customerSearch)))
                    .map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setShowCustomerResults(false);
                          setCustomerSearch('');
                        }}
                        className="w-full text-right p-3 hover:bg-stone-50 border-b border-stone-50 last:border-0 flex flex-col"
                      >
                        <span className="font-bold text-sm text-stone-800">{c.name}</span>
                        <span className="text-xs text-stone-500">{c.phone || 'بدون رقم'} • {formatCurrency(c.balance)}</span>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Notes */}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات الطلب (اختياري)..."
              className="input text-sm py-2"
            />

            {/* Discount */}
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent || ''}
                onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                placeholder="خصم %"
                className="input text-sm py-2 w-24"
              />
              {discountPercent > 0 && (
                <span className="text-sm text-green-600 font-medium">
                  - {formatCurrency(discountAmount)}
                </span>
              )}
            </div>

            {/* Totals */}
            <div className="bg-stone-50 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-sm text-stone-600">
                <span>المجموع الفرعي:</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>الخصم ({formatNumber(discountPercent)}%):</span>
                  <span>- {formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-stone-900 pt-1 border-t border-stone-200">
                <span>الإجمالي:</span>
                <span className="text-coffee-700">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="grid grid-cols-4 gap-2">
              {(['cash', 'card', 'mixed', 'debt'] as const).map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  disabled={method === 'debt' && !selectedCustomer}
                  className={`py-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-1 ${paymentMethod === method
                      ? 'bg-coffee-600 text-white'
                      : method === 'debt' && !selectedCustomer
                        ? 'bg-stone-50 text-stone-300 cursor-not-allowed'
                        : 'bg-stone-100 text-stone-600 hover:bg-coffee-50'
                    }`}
                >
                  {method === 'cash' ? <Banknote className="w-4 h-4" />
                    : method === 'card' ? <CreditCard className="w-4 h-4" />
                      : method === 'mixed' ? <FileText className="w-4 h-4" />
                        : <Coins className="w-4 h-4" />}
                  {method === 'cash' ? 'نقداً' : method === 'card' ? 'بطاقة' : method === 'mixed' ? 'مختلط' : 'دين'}
                </button>
              ))}
            </div>

            {/* Mixed Payment Split */}
            {paymentMethod === 'mixed' && (
              <div className="bg-stone-50 p-3 rounded-xl flex gap-3 items-center border border-stone-200 mt-0 mb-2">
                <div className="flex-1">
                  <label className="text-[10px] text-stone-500 mb-1 font-bold block">المدفوع كاش</label>
                  <input 
                    type="number" 
                    value={mixedCashAmount} 
                    onChange={e => setMixedCashAmount(e.target.value)}
                    className="input py-2 text-sm max-w-full font-mono text-center font-bold text-green-700 bg-white"
                    placeholder="0.00"
                  />
                </div>
                {selectedCustomer ? (
                  <>
                    <div className="flex-1">
                      <label className="text-[10px] text-stone-500 mb-1 font-bold block">المدفوع بطاقة</label>
                      <input 
                        type="number" 
                        value={mixedCardAmount} 
                        onChange={e => setMixedCardAmount(e.target.value)}
                        className="input py-2 text-sm max-w-full font-mono text-center font-bold text-blue-700 bg-white"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-stone-500 mb-1 font-bold block">الباقي (دين)</label>
                      <div className="input py-2 text-sm bg-white/50 border-transparent text-center font-mono font-bold text-red-700">
                        {formatCurrency(Math.max(0, total - ((parseFloat(mixedCashAmount) || 0) + (parseFloat(mixedCardAmount) || 0))))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1">
                    <label className="text-[10px] text-stone-500 mb-1 font-bold block">الباقي (بطاقة)</label>
                    <div className="input py-2 text-sm bg-white/50 border-transparent text-center font-mono font-bold text-blue-700">
                      {formatCurrency(Math.max(0, total - (parseFloat(mixedCashAmount) || 0)))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Complete Sale & Print order */}
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handlePrintPreliminary}
                disabled={cart.length === 0}
                className="btn-secondary justify-center py-3.5 px-4 text-base disabled:opacity-50 flex-shrink-0 whitespace-nowrap bg-stone-200"
                title="طباعة مبدئية"
              >
                <Printer className="w-5 h-5 mx-auto" />
                <span className="text-xs mt-0.5 block font-bold">طباعة الطلب</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCompleteSale}
                disabled={cart.length === 0 || processing}
                className="w-full btn-primary justify-center py-3.5 flex-col flex gap-0.5 text-base disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  {processing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  <span>{processing ? 'جارٍ المعالجة...' : 'إتمام البيع'}</span>
                </div>
                {!processing && <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded opacity-90">{formatCurrency(total)}</span>}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Receipt Modal */}
        <AnimatePresence>
          {showReceipt && completedSale && (
            <div className="modal-overlay">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
              >
                <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="font-bold text-stone-900">الفاتورة</h3>
                  <button onClick={() => setShowReceipt(false)} className="btn-icon">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="font-bold text-stone-900 text-lg">تم إتمام البيع بنجاح</p>
                    <p className="text-stone-500 text-sm">{completedSale.invoice_number}</p>
                  </div>

                  <div className="bg-stone-50 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-500">الإجمالي:</span>
                      <span className="font-bold text-coffee-700">{formatCurrency(completedSale.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">طريقة الدفع:</span>
                      <span>{completedSale.payment_method === 'cash' ? 'نقداً' : completedSale.payment_method === 'card' ? 'بطاقة' : completedSale.payment_method === 'mixed' ? 'مختلط' : 'دين'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">الكاشير:</span>
                      <span>{user?.full_name}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-stone-100 flex gap-3">
                  <button onClick={() => setShowReceipt(false)} className="btn-secondary flex-1 justify-center">
                    إغلاق
                  </button>
                  <button onClick={() => { printReceipt(); }} className="btn-primary flex-1 justify-center">
                    <Printer className="w-4 h-4" />
                    طباعة
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Previous Invoices Modal */}
        <AnimatePresence>
          {showRecentSalesModal && (
            <div className="modal-overlay z-50">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
              >
                <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-coffee-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-coffee-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900 text-lg">الفواتير السابقة</h3>
                      <p className="text-xs text-stone-500 mt-0.5">أحدث 10 فواتير مبيعات</p>
                    </div>
                  </div>
                  <button onClick={() => setShowRecentSalesModal(false)} className="btn-icon bg-white text-stone-400 hover:text-stone-600 shadow-sm border border-stone-200">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 bg-stone-50/30">
                  {loadingRecentSales ? (
                     <div className="flex justify-center items-center py-12">
                        <div className="w-8 h-8 border-4 border-coffee-200 border-t-coffee-600 rounded-full animate-spin"></div>
                     </div>
                  ) : recentSales.length === 0 ? (
                     <div className="text-center text-stone-400 py-12 flex flex-col items-center">
                       <FileText className="w-12 h-12 mb-3 opacity-20" />
                       <p className="font-medium text-lg">لا توجد فواتير سابقة</p>
                     </div>
                  ) : (
                     <div className="space-y-3">
                       {recentSales.map((sale) => (
                         <div key={sale.id} className="flex hidden-print items-center justify-between p-4 bg-white border border-stone-100 rounded-xl hover:border-coffee-300 hover:shadow-md transition-all cursor-pointer group" onClick={() => handleViewPreviousSale(sale.id)}>
                           <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-xl bg-stone-50 flex flex-col items-center justify-center border border-stone-100 group-hover:bg-coffee-50 transition-colors">
                               <Receipt className="w-5 h-5 text-stone-400 group-hover:text-coffee-500" />
                             </div>
                             <div>
                               <div className="font-bold text-stone-800 text-base group-hover:text-coffee-700 transition-colors">{sale.invoice_number}</div>
                               <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5 font-medium">
                                 <span>{new Date(sale.created_at).toLocaleTimeString('ar-LY', {hour: '2-digit', minute:'2-digit'})}</span>
                                 <span className="w-1 h-1 rounded-full bg-stone-300"></span>
                                 <span className={sale.payment_method === 'debt' ? 'text-red-500' : 'text-stone-500'}>
                                   {sale.payment_method === 'cash' ? 'نقداً' : sale.payment_method === 'card' ? 'بطاقة' : sale.payment_method === 'mixed' ? 'مختلط' : 'دين'}
                                 </span>
                               </div>
                             </div>
                           </div>
                           <div className="text-left flex flex-col items-end">
                             <div className="font-black text-lg text-stone-900">{formatCurrency(sale.total)}</div>
                             <button className="text-xs text-coffee-600 hover:text-coffee-800 font-bold mt-1.5 flex items-center gap-1.5 bg-coffee-50 px-2.5 py-1 rounded-lg">
                               <Printer className="w-3.5 h-3.5"/> عرض وطباعة
                             </button>
                           </div>
                         </div>
                       ))}
                     </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Viewed Receipt Modal */}
        <AnimatePresence>
          {showViewedReceipt && viewedSale && (
            <div className="modal-overlay z-50">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
              >
                <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="font-bold text-stone-900">إعادة طباعة الفاتورة</h3>
                  <button onClick={() => setShowViewedReceipt(false)} className="btn-icon">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-5">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-coffee-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <FileText className="w-6 h-6 text-coffee-600" />
                    </div>
                    <p className="font-bold text-stone-900 text-lg">{viewedSale.invoice_number}</p>
                    <p className="text-stone-500 text-sm" dir="ltr">{new Date(viewedSale.created_at).toLocaleString('en-GB')}</p>
                  </div>
                  <div className="bg-stone-50 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-500">الإجمالي:</span>
                      <span className="font-bold text-coffee-700">{formatCurrency(viewedSale.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">طريقة الدفع:</span>
                      <span>{viewedSale.payment_method === 'cash' ? 'نقداً' : viewedSale.payment_method === 'card' ? 'بطاقة' : viewedSale.payment_method === 'mixed' ? 'مختلط' : 'دين'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">الكاشير:</span>
                      <span>{viewedSale.cashier_name || 'غير معروف'}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-stone-100 flex gap-3">
                  <button onClick={() => setShowViewedReceipt(false)} className="btn-secondary flex-1 justify-center">
                    إغلاق
                  </button>
                  <button onClick={() => { printReceipt(); setShowViewedReceipt(false); }} className="btn-primary flex-1 justify-center">
                    <Printer className="w-4 h-4" />
                    طباعة مجدداً
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Visible ONLY during print */}
      <div id="printable-receipt" className="pos-receipt-print">
        {showViewedReceipt && viewedSale ? (
          <ReceiptPrint sale={viewedSale} cashierName={viewedSale.cashier_name || ''} />
        ) : completedSale ? (
          <ReceiptPrint sale={completedSale} cashierName={user?.full_name || ''} />
        ) : null}
      </div>

      <style>{`
        .pos-receipt-print {
          display: none;
        }
        @media print {
          .pos-ui-container {
            display: none !important;
          }
          .pos-receipt-print {
            display: block !important;
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
            font-weight: 900 !important;
          }
          aside {
            display: none !important;
          }
          main {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            min-height: 0 !important;
          }
          @page {
            margin: 0;
            size: auto;
          }
        }
      `}</style>
    </>
  );
};

export default POSPage;
