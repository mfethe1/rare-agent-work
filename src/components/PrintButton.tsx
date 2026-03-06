'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="border border-gray-700 text-white px-5 py-3 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
    >
      🖨 Export / Print PDF
    </button>
  );
}
