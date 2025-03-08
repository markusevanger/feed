
import { Skeleton } from "@/components/ui/skeleton";
import { Loader } from "lucide-react";
export default function VideoSkeleton() {
    return (
        <Skeleton className="w-full h-full bg-muted rounded-lg flex flex-col items-center justify-center gap-2 text-sm font-mono"> Loading full-res video <Loader className="w-4 h-4 animate-spin" /></Skeleton>
    );
}


