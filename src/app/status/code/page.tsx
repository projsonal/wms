import { notFound } from 'next/navigation';
import { StatusScreen, type StatusCode } from '@/component/system/StatusScreen';

const VALID_CODES: StatusCode[] = ['400', '401', '403', '404', '408', '429', '500', '502', '503', '504'];

function isStatusCode(value: string): value is StatusCode {
  return (VALID_CODES as string[]).includes(value);
}

export default async function StatusCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<React.JSX.Element> {
  const { code } = await params;
  if (!isStatusCode(code)) {
    notFound();
  }
  return <StatusScreen code={code} />;
}
