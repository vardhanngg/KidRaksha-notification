export default function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="brand" style={{ color: dark ? "#fff" : undefined }}>
      <span className="brandMark">KR</span>
      <span>KidRaksha</span>
    </div>
  );
}
