import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ForgotPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>忘记密码</AlertDialogTitle>
          <AlertDialogDescription>请联系管理员重置密码。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>知道了</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ForgotPasswordLink({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto p-0 text-sm font-medium text-blue-600"
      data-testid="forgot-password-link"
      onClick={onClick}
    >
      忘记密码
    </Button>
  );
}
