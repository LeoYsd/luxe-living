import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ReferralCodePrompt({ user, onSubmitted }) {
    const [open, setOpen] = useState(true);
    const [code, setCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Check for referral code in localStorage first (set by ReferralTracker)
        const storedCode = localStorage.getItem('luxeliving_referral_code');
        if (storedCode) {
            console.log('📋 Found stored referral code in localStorage:', storedCode);
            setCode(storedCode);
        } else {
            // Fallback: Check URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const refCode = urlParams.get('ref');
            if (refCode) {
                console.log('📋 Found referral code in URL:', refCode);
                setCode(refCode);
            }
        }
    }, []);

    const handleSubmit = async () => {
        if (!code.trim()) {
            setError("Please enter a referral code");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        
        try {
            console.log('═══════════════════════════════════════');
            console.log('🚀 STARTING REFERRAL CODE APPLICATION');
            console.log('═══════════════════════════════════════');
            console.log('📋 Code entered:', code.trim().toUpperCase());
            console.log('👤 Current user:', user.email);
            
            // Step 1: Find the referrer by the code they entered
            console.log('\n📡 Step 1: Looking up referrer...');
            let referrers;
            try {
                referrers = await base44.entities.User.filter({ referral_code: code.trim().toUpperCase() });
                console.log('✅ Query successful, found', referrers.length, 'users');
            } catch (queryErr) {
                console.error('❌ Query failed:', queryErr);
                throw new Error(`Database query failed: ${queryErr.message}`);
            }
            
            if (referrers.length === 0) {
                console.log('⚠️ No user found with this referral code');
                setError("This referral code is not valid. Please check and try again.");
                setIsLoading(false);
                return;
            }
            
            const referrer = referrers[0];
            console.log('✅ Found referrer:', referrer.email);
            console.log('   Referrer ID:', referrer.id);
            
            // Step 2: Prevent self-referral
            console.log('\n🔍 Step 2: Checking for self-referral...');
            if (referrer.email === user.email) {
                console.log('❌ Self-referral detected!');
                setError("You cannot use your own referral code!");
                setIsLoading(false);
                return;
            }
            console.log('✅ Not a self-referral');
            
            // Step 3: Check if already referred
            console.log('\n🔍 Step 3: Checking if user already has a referral code...');
            if (user.referred_by_code) {
                console.log('⚠️ User already has referred_by_code:', user.referred_by_code);
                setError("You've already used a referral code!");
                setIsLoading(false);
                return;
            }
            console.log('✅ User has no existing referral code');
            
            // Step 4: Update current user
            console.log('\n📝 Step 4: Updating current user with referral code...');
            try {
                await base44.auth.updateMe({ 
                    referred_by_code: code.trim().toUpperCase(),
                    referral_prompt_seen: true
                });
                console.log('✅ User updated successfully');
            } catch (updateErr) {
                console.error('❌ User update failed:', updateErr);
                console.error('Update error details:', {
                    message: updateErr.message,
                    response: updateErr.response?.data,
                    status: updateErr.response?.status
                });
                throw new Error(`Failed to update user: ${updateErr.message}`);
            }
            
            // Step 5: Create Referral record
            console.log('\n📝 Step 5: Creating Referral record...');
            try {
                const referralData = {
                    referrer_email: referrer.email,
                    referred_email: user.email,
                    status: 'signed_up'
                };
                console.log('Referral data:', referralData);
                
                await base44.entities.Referral.create(referralData);
                console.log('✅ Referral record created successfully');
            } catch (referralErr) {
                console.error('❌ Referral creation failed:', referralErr);
                console.error('Referral error details:', {
                    message: referralErr.message,
                    response: referralErr.response?.data
                });
                // Don't throw - user is already updated, this is secondary
                console.log('⚠️ Continuing despite referral record error');
            }
            
            // Step 6: Cleanup
            console.log('\n🧹 Step 6: Cleaning up...');
            localStorage.removeItem('luxeliving_referral_code');
            console.log('✅ Cleared referral code from localStorage');
            
            console.log('\n═══════════════════════════════════════');
            console.log('🎉 REFERRAL CODE APPLICATION COMPLETE!');
            console.log('═══════════════════════════════════════\n');
            
            alert('🎉 Referral code applied! Your referrer will earn rewards when you make your first booking!');
            
            onSubmitted();
            setOpen(false);

        } catch (err) {
            console.error('\n❌❌❌ CRITICAL ERROR ❌❌❌');
            console.error('Error:', err);
            console.error('Message:', err.message);
            console.error('Stack:', err.stack);
            console.error('Response:', err.response);
            console.error('═══════════════════════════════════════\n');
            
            setError(err.message || 'An error occurred. Please try again.');
        }
        setIsLoading(false);
    };

    const handleSkip = async () => {
        try {
            await base44.auth.updateMe({ referral_prompt_seen: true });
            // Clear stored code if user skips
            localStorage.removeItem('luxeliving_referral_code');
            onSubmitted();
            setOpen(false);
        } catch (error) {
            console.error('Error marking prompt as seen:', error);
            setOpen(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleSkip()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Welcome to Luxeliving! 🎉</DialogTitle>
                    <DialogDescription>
                        Did a friend refer you? Enter their referral code below to help them earn rewards when you book!
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Input 
                        placeholder="Enter referral code (e.g. JOHN1A2B3C4D)" 
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value.toUpperCase());
                            setError(null);
                        }}
                        className="uppercase"
                        disabled={isLoading}
                    />
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}
                    {code && !error && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-700">
                                ℹ️ You'll be connected to the user with code: <strong>{code}</strong>
                            </p>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-4">
                    <Button variant="ghost" onClick={handleSkip} disabled={isLoading}>
                        Skip for now
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isLoading || !code.trim()}
                        className="bg-gradient-to-r from-slate-900 to-slate-800"
                    >
                        {isLoading ? "Applying..." : "Apply Code"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}