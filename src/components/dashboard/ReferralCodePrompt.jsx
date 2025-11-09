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
        // Check for referral code in URL parameters when component mounts
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
            setCode(refCode);
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
            console.log('🔍 Validating referral code:', code);
            
            // 1. Find the referrer by the code they entered
            const referrers = await base44.entities.User.filter({ referral_code: code.trim().toUpperCase() });
            
            if (referrers.length === 0) {
                setError("This referral code is not valid. Please check and try again.");
                setIsLoading(false);
                return;
            }
            
            const referrer = referrers[0];
            
            // Prevent self-referral
            if (referrer.email === user.email) {
                setError("You cannot use your own referral code!");
                setIsLoading(false);
                return;
            }
            
            console.log('✅ Valid referrer found:', referrer.email);
            
            // 2. Update the current user's data
            await base44.auth.updateMe({ 
                referred_by_code: code.trim().toUpperCase(),
                has_seen_referral_prompt: true 
            });
            
            console.log('✅ User updated with referral code');
            
            // 3. Create a new Referral record to track the relationship
            await base44.entities.Referral.create({
                referrer_email: referrer.email,
                referred_email: user.email,
                status: 'signed_up'
            });
            
            console.log('✅ Referral record created');
            
            alert('🎉 Referral code applied! Your referrer will earn points when you make your first booking!');
            
            onSubmitted(); // This will close the dialog and reload data
            setOpen(false);

        } catch (err) {
            console.error('❌ Error applying referral code:', err);
            setError("An error occurred. Please try again.");
        }
        setIsLoading(false);
    };

    const handleSkip = async () => {
        try {
            await base44.auth.updateMe({ has_seen_referral_prompt: true });
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
                    <DialogTitle className="text-2xl">Welcome to Luxeliving!</DialogTitle>
                    <DialogDescription>
                        Did a friend refer you? Enter their referral code below to help them earn rewards.
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
                    {error && <p className="text-sm text-red-500">{error}</p>}
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