'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Cropper from 'react-easy-crop';
import toast from 'react-hot-toast';

async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No 2d context'));

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas is empty'));
        const file = new File([blob], 'cropped.jpeg', { type: 'image/jpeg' });
        resolve(file);
      }, 'image/jpeg');
    };
    image.onerror = (error) => reject(error);
  });
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<{ email: string; profileImageUrl: string | null }>({ email: '', profileImageUrl: null });
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSource, setCropImageSource] = useState<string | null>(null);
  
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/admin/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setNewEmail(data.email);
        }
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setCropImageSource(url);
    setCropModalOpen(true);
    if (fileRef.current) fileRef.current.value = ''; // Reset input
  }

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!cropImageSource || !croppedAreaPixels) return;
    try {
      const croppedFile = await getCroppedImg(cropImageSource, croppedAreaPixels);
      setPendingImage(croppedFile);
      setPreviewImage(URL.createObjectURL(croppedFile));
      setCropModalOpen(false);
      setCropImageSource(null);
    } catch (e) {
      console.error('Failed to crop image', e);
    }
  };

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload: any = {};
      if (newEmail !== profile.email) payload.email = newEmail;
      if (newPassword) {
        if (!currentPassword) throw new Error('Current password required to set a new one.');
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      if (Object.keys(payload).length === 0 && !pendingImage) {
        setSaving(false);
        return;
      }

      let profileUpdated = false;

      // Handle Image Upload first
      if (pendingImage) {
        const fd = new FormData();
        fd.append('profileImage', pendingImage);
        const imgRes = await fetch('/api/admin/profile', { method: 'PUT', body: fd });
        const imgData = await imgRes.json();
        if (!imgRes.ok) throw new Error(imgData.error || 'Image upload failed');
        
        setProfile(p => ({ ...p, profileImageUrl: imgData.profileImageUrl }));
        setPendingImage(null);
        profileUpdated = true;
      }

      // Handle Password/Email
      if (Object.keys(payload).length > 0) {
        const res = await fetch('/api/admin/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');

        setCurrentPassword('');
        setNewPassword('');
        
        if (payload.email) {
          setProfile(p => ({ ...p, email: payload.email }));
        }
        profileUpdated = true;
      }

      if (profileUpdated) {
        toast.success('Profile updated successfully!');
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4 sm:p-8 text-slate-500">Loading profile...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl w-full">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6">Edit Profile</h1>

      {/* Profile Picture Upload */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
        <div className="relative group cursor-pointer flex-shrink-0" onClick={() => fileRef.current?.click()}>
          {previewImage || profile.profileImageUrl ? (
            <img src={previewImage || profile.profileImageUrl || ''} alt="Profile" className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-slate-100" />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl sm:text-3xl font-bold">
              {profile.email?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Profile Picture</h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-3">JPG, PNG or GIF. Max size of 5MB.</p>
          <button onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition">
            Change Picture
          </button>
          <input type="file" ref={fileRef} onChange={handleImageUpload} accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" />
        </div>
      </div>

      {/* Account Details */}
      <form onSubmit={handleSaveDetails} className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">

        <h2 className="text-base sm:text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Account Security</h2>

        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
          <input 
            type="email" 
            value={newEmail} 
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900" 
            required 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
            <div className="relative">
              <input 
                type={showCurrentPw ? 'text' : 'password'} 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 pr-10" 
              />
              <button 
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrentPw ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.71-2.29c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <div className="relative">
              <input 
                type={showNewPw ? 'text' : 'password'} 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 pr-10" 
              />
              <button 
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPw ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.71-2.29c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button 
            type="submit" 
            disabled={saving || (newEmail === profile.email && !newPassword && !pendingImage)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Crop Modal */}
      {cropModalOpen && cropImageSource && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[100dvh] overflow-y-auto flex flex-col border border-slate-800">
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-800/80 sticky top-0 bg-slate-900 z-10">
              <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide">Crop Photo</h3>
              <button onClick={() => setCropModalOpen(false)} className="text-slate-400 hover:text-white transition bg-slate-800 hover:bg-slate-700 p-1.5 rounded-full">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="relative w-full h-[50vh] min-h-[250px] max-h-[400px] bg-black">
              <Cropper
                image={cropImageSource}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={true}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                objectFit="contain"
              />
            </div>
            <div className="p-4 sm:p-6 bg-slate-900">
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 px-1 sm:px-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.05}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
              </div>
              <div className="flex justify-between gap-3 sm:gap-4">
                <button 
                  onClick={() => setCropModalOpen(false)}
                  className="flex-1 py-2.5 sm:py-3.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg sm:rounded-xl transition border border-slate-700"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleApplyCrop}
                  className="flex-1 py-2.5 sm:py-3.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg sm:rounded-xl transition shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
