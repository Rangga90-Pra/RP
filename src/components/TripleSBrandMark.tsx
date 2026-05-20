import Image from "next/image";

/** Official Triple S Indosedulur brand mark (JPEG in /public). */
export function TripleSBrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/triple-s-logo.jpg"
      alt="Triple S Indosedulur"
      width={96}
      height={96}
      className={className ? `object-contain ${className}` : "object-contain"}
      priority
      sizes="64px"
    />
  );
}
