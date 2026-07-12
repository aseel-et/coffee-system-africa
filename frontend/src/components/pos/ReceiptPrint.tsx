import React from 'react';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';

interface ReceiptPrintProps {
  sale: any;
  cashierName: string;
}

const ReceiptPrint: React.FC<ReceiptPrintProps> = ({ sale, cashierName }) => {
  if (!sale) return null;

  const invoiceNumber = sale.invoice_number || '';
  const date = sale.created_at ? formatDate(sale.created_at, 'datetime') : '';
  const items = sale.items || [];
  const subtotal = sale.subtotal || 0;
  const discount = sale.discount_amount || 0;
  const total = sale.total || 0;

  return (
    <div className="print-receipt bg-white text-black font-arabic dir-rtl" style={{ direction: 'rtl', color: '#000', width: '270px', paddingRight: '5px', paddingLeft: '35px' }}>
      {/* Header with logo-like text */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-black mb-1 leading-none" style={{ color: '#000' }}>كافيتيريا جامعة أفريقيا</h1>
        <p className="text-[9px] font-bold tracking-widest uppercase opacity-80" style={{ color: '#000' }}>Africa University Cafeteria</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="h-[1px] bg-black/30 flex-1"></div>
          <span className="text-[9px] font-bold px-2 py-0.5 border border-black/30 rounded uppercase">فاتورة مبيعات</span>
          <div className="h-[1px] bg-black/30 flex-1"></div>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs font-bold mb-3 space-y-1">
        <div className="flex justify-between">
          <span>رقم الفاتورة:</span>
          <span className="font-bold">{invoiceNumber}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>التاريخ:</span>
          <span dir="ltr" className="font-mono-nums text-xs whitespace-nowrap">{date}</span>
        </div>
        <div className="flex justify-between">
          <span>الكاشير:</span>
          <span>{cashierName}</span>
        </div>
      </div>

      <div className="border-b-2 border-dashed border-gray-400 my-2"></div>

      {/* Items Header */}
      <div className="flex justify-between text-xs font-black mb-2 border-b border-black/20 pb-1">
        <span className="flex-1 pr-1">المنتج</span>
        <span className="w-10 text-center">الكـمية</span>
        <span className="w-14 text-left pl-1">المجموع</span>
      </div>

      {/* Items */}
      <div className="text-xs font-bold space-y-2 mb-3">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between items-start">
            <span className="flex-1 pr-1 leading-tight">{item.product_name}</span>
            <span className="w-10 text-center">{formatNumber(item.quantity)}</span>
            <span className="w-14 text-left font-mono-nums">{formatCurrency(item.total).replace(' د.ل', '')}</span>
          </div>
        ))}
      </div>

      <div className="border-b-2 border-dashed border-gray-400 my-2"></div>

      {/* Totals */}
      <div className="text-xs font-bold space-y-1 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-black">المجموع الفرعي:</span>
          <span className="font-black pr-2">{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-black">الخصم:</span>
            <span className="font-black pr-2">- {formatCurrency(discount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center text-sm font-black mt-2 pt-2 border-t-2 border-black">
          <span>الإجمالي:</span>
          <span className="text-lg pl-2">{formatCurrency(total)}</span>
        </div>
        {sale.payment_method && (
          <div className="flex justify-between text-[10px] text-gray-500 mt-2">
            <span>طريقة الدفع:</span>
            <span className="font-bold whitespace-nowrap">{sale.payment_method === 'cash' ? 'نقداً' : sale.payment_method === 'card' ? 'بطاقة' : sale.payment_method === 'debt' ? 'دين' : 'مختلط'}</span>
          </div>
        )}
        {sale.notes && (
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>ملاحظات:</span>
            <span className="font-bold text-left ml-2 whitespace-pre-wrap">{sale.notes}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-2 border-dashed border-gray-400 pt-3 text-center">
        <p className="font-black text-xs text-black">شكراً لزيارتكم</p>
        <p className="text-[9px] font-bold opacity-80 mt-0.5">Thank you for your visit</p>
      </div>
    </div>
  );
};

export default ReceiptPrint;
