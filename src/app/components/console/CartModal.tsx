import { Fragment, useState } from 'react';
import { FileText, Upload, X, ShoppingCart, CheckCircle2 } from 'lucide-react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { UploadPoDrawer } from './UploadPoDrawer';
import { usePoUploads } from '../../context/PoUploadsContext';

const QUOTE_PDF_HREF = `${import.meta.env.BASE_URL}Quote_CSR-1775830431087.pdf`;

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartModal({ isOpen, onClose }: CartModalProps) {
  const { addUpload } = usePoUploads();
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [justSubmittedPo, setJustSubmittedPo] = useState<string | null>(null);

  return (
    <Fragment>
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="flex w-[600px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="flex items-center gap-2 font-['SF_Pro',sans-serif]">
              <ShoppingCart className="w-5 h-5" />
              Shopping Cart
            </SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              1 Quote pending Acceptance
            </SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-4">
        {/* Action Options */}
        <div className="space-y-4">
          {/* View Quote Option */}
          <div className="bg-white border-2 border-blue-200 rounded-lg p-5 hover:border-blue-300 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-1">
                  View Quote
                </h3>
                <p className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif] mb-3">
                  Review detailed pricing breakdown, terms, and conditions before proceeding with purchase
                </p>
                <Button
                  className="flex items-center gap-2 text-[13px] font-[590] border-blue-600 text-white bg-blue-600 hover:bg-blue-800 w-50"
                  asChild
                >
                  <a
                    href={QUOTE_PDF_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="w-4 h-4" />
                    View Quote
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Upload PO Option */}
          <div className="bg-white border-2 border-green-200 rounded-lg p-5 hover:border-green-300 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Upload className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-1">
                  Upload Purchase Order
                </h3>
                <p className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif] mb-3">
                  Upload your signed PO to complete the purchase contract and initiate Subscription Activation
                </p>
                {justSubmittedPo ? (
                  <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-[13px] font-medium text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {justSubmittedPo} submitted for OM review
                  </div>
                ) : (
                  <Button
                    onClick={() => setUploadDrawerOpen(true)}
                    className="flex items-center gap-2 text-[13px] font-[590] bg-green-600 hover:bg-green-700 text-white"
                    variant='secondary'
                  >
                    <Upload className="w-4 h-4" />
                    Upload PO 
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-[12px] font-normal text-gray-700 font-['SF_Pro',sans-serif]">
              <p className="font-[590] text-[#1c1c1c] mb-1">Next Steps:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Review the quote and share with your procurement team</li>
                <li>Obtain internal approval and generate a PO</li>
                <li>Upload the signed PO to activate your subscription</li>
              </ul>
            </div>
          </div>
        </div>
        </SheetBody>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-background px-6 py-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-[13px] font-[590]"
          >
            Continue Shopping
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2 text-[13px] font-[590]"
          >
            <X className="w-4 h-4" />
            Clear Cart
          </Button>
        </div>
        </SheetContent>
      </Sheet>

      <UploadPoDrawer
        isOpen={uploadDrawerOpen}
        onClose={() => setUploadDrawerOpen(false)}
        onSubmit={(entry) => {
          addUpload(entry);
          setUploadDrawerOpen(false);
          setJustSubmittedPo(entry.poNumber);
        }}
      />
    </Fragment>
  );
}