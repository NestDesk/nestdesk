declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

declare global {
  interface Window {
    Razorpay: new (options: {
      key: string;
      amount?: number;
      currency?: string;
      name: string;
      description?: string;
      order_id: string;
      handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => void;
      modal?: {
        ondismiss?: () => void;
      };
      theme?: {
        color?: string;
      };
    }) => {
      open: () => void;
      on: (
        event: "payment.failed",
        handler: (response: { error?: { description?: string } }) => void,
      ) => void;
    };
  }
}

export {};
