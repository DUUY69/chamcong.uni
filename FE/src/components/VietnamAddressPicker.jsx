import { useState, useEffect } from "react";
import { MobileField, MobileSelect } from "@/components/mobile/MobileCard";
import { provinces } from "@/data/vietnam-address-data";

/**
 * VietnamAddressPicker – 3 cascading dropdowns: Tỉnh/TP → Quận/Huyện → Phường/Xã
 *
 * Props:
 *   onChange(addressText: string) – called whenever selection changes
 *   initialAddress?: string       – pre-populate from existing address text
 */
export function VietnamAddressPicker({ onChange, initialAddress }) {
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedWard, setSelectedWard]         = useState(null);

  // Pre-populate from initialAddress on mount
  useEffect(() => {
    if (!initialAddress) return;

    // Split right-to-left: last part = province, second-to-last = district, rest = ward
    const parts = initialAddress.split(", ");
    if (parts.length === 0) return;

    const provinceName = parts[parts.length - 1]?.trim();
    const districtName = parts[parts.length - 2]?.trim();
    const wardName     = parts.slice(0, parts.length - 2).join(", ").trim();

    const province = provinces.find(p => p.name === provinceName);
    if (!province) return;

    setSelectedProvince(province);

    if (districtName) {
      const district = province.districts.find(d => d.name === districtName);
      if (!district) return;
      setSelectedDistrict(district);

      if (wardName) {
        const ward = district.wards.find(w => w.name === wardName);
        if (ward) setSelectedWard(ward);
      }
    }
  }, [initialAddress]);

  // Build address text whenever selection changes
  const buildAddress = (province, district, ward) => {
    if (ward && district && province) return `${ward.name}, ${district.name}, ${province.name}`;
    if (district && province)         return `${district.name}, ${province.name}`;
    if (province)                     return province.name;
    return "";
  };

  const handleProvinceChange = (e) => {
    const code = e.target.value;
    if (!code) {
      setSelectedProvince(null);
      setSelectedDistrict(null);
      setSelectedWard(null);
      onChange?.("");
      return;
    }
    const province = provinces.find(p => p.code === code);
    setSelectedProvince(province ?? null);
    setSelectedDistrict(null);
    setSelectedWard(null);
    onChange?.(buildAddress(province, null, null));
  };

  const handleDistrictChange = (e) => {
    const code = e.target.value;
    if (!code) {
      setSelectedDistrict(null);
      setSelectedWard(null);
      onChange?.(buildAddress(selectedProvince, null, null));
      return;
    }
    const district = selectedProvince?.districts.find(d => d.code === code);
    setSelectedDistrict(district ?? null);
    setSelectedWard(null);
    onChange?.(buildAddress(selectedProvince, district, null));
  };

  const handleWardChange = (e) => {
    const code = e.target.value;
    if (!code) {
      setSelectedWard(null);
      onChange?.(buildAddress(selectedProvince, selectedDistrict, null));
      return;
    }
    const ward = selectedDistrict?.wards.find(w => w.code === code);
    setSelectedWard(ward ?? null);
    onChange?.(buildAddress(selectedProvince, selectedDistrict, ward));
  };

  const districts = selectedProvince?.districts ?? [];
  const wards     = selectedDistrict?.wards ?? [];

  return (
    <div className="flex flex-col gap-2">
      {/* Tỉnh / Thành phố */}
      <MobileField label="Tỉnh/Thành phố">
        <MobileSelect value={selectedProvince?.code ?? ""} onChange={handleProvinceChange}>
          <option value="">-- Chọn tỉnh/thành --</option>
          {provinces.map(p => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </MobileSelect>
      </MobileField>

      {/* Quận / Huyện */}
      <MobileField label="Quận/Huyện">
        <MobileSelect
          value={selectedDistrict?.code ?? ""}
          onChange={handleDistrictChange}
          className={!selectedProvince ? "opacity-50 cursor-not-allowed" : ""}
        >
          <option value="">-- Chọn quận/huyện --</option>
          {districts.map(d => (
            <option key={d.code} value={d.code}>{d.name}</option>
          ))}
        </MobileSelect>
      </MobileField>

      {/* Phường / Xã */}
      <MobileField label="Phường/Xã">
        <MobileSelect
          value={selectedWard?.code ?? ""}
          onChange={handleWardChange}
          className={!selectedDistrict ? "opacity-50 cursor-not-allowed" : ""}
        >
          <option value="">-- Chọn phường/xã --</option>
          {wards.map(w => (
            <option key={w.code} value={w.code}>{w.name}</option>
          ))}
        </MobileSelect>
      </MobileField>
    </div>
  );
}

export default VietnamAddressPicker;
