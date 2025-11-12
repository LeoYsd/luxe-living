
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, MapPin, Users, ArrowLeft, CheckCircle, Loader2, Clock, AlertCircle, Shield, Phone } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Core state
  const [property, setProperty] = useState(null);
  const [user, setUser] = useState(null);
  const [existingBooking, setExistingBooking] = useState(null);
  const [bookingDetails, setBookingDetails] = useState({
    checkIn: null,
    checkOut: null,
    guests: 2,
    specialRequests: ''
  });
  const [totalPrice, setTotalPrice] = useState(0);
  const [nights, setNights] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  
  // Phone number modal state
  const [showPhoneNumberModal, setShowPhoneNumberModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  
  // Availability check state
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState('unknown');
  const [availabilityRequestId, setAvailabilityRequestId] = useState(null);
  const [availabilityError, setAvailabilityError] = useState(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState(null);

  const calculateLoyaltyTier = (points) => {
    if (points >= 10000) return 'Diamond';
    if (points >= 5000) return 'Platinum';
    if (points >= 2500) return 'Gold';
    if (points >= 1000) return 'Silver';
    return 'Bronze';
  };

  const awardBookingPoints = async (bookingData) => {
    try {
      console.log('🎁 Starting loyalty points award process...');
      
      const freshUser = await base44.auth.me();
      const pointsEarned = Math.floor(bookingData.total_price * 0.05);
      const newTotalPoints = (freshUser.loyalty_points || 0) + pointsEarned;
      const newTier = calculateLoyaltyTier(newTotalPoints);
      
      console.log(`💰 Awarding ${pointsEarned} points (5% of ${bookingData.total_price})`);
      
      await base44.auth.updateMe({
        loyalty_points: newTotalPoints,
        loyalty_tier: newTier
      });
      
      await base44.entities.LoyaltyTransaction.create({
        user_email: freshUser.email,
        points_earned: pointsEarned,
        transaction_type: 'booking',
        booking_id: bookingData.id,
        description: `Earned ${pointsEarned} points from booking at ${property.title}`
      });
      
      console.log('✅ Loyalty points awarded successfully');
      
      return { pointsEarned, newTotalPoints, newTier };
    } catch (error) {
      console.error('❌ Error awarding loyalty points:', error);
      throw error;
    }
  };

  const processReferralReward = async (bookingData, bookingUser) => {
    try {
      console.log('🔍 Checking for referral rewards...');
      
      if (!bookingUser.referred_by_code) {
        console.log('ℹ️ No referral code found for this user');
        return null;
      }
      
      const referrers = await base44.entities.User.filter({ 
        referral_code: bookingUser.referred_by_code 
      });
      
      if (referrers.length === 0) {
        console.log('⚠️ Referrer not found');
        return null;
      }
      
      const referrer = referrers[0];
      console.log(`👤 Found referrer: ${referrer.email}`);
      
      let referralRecord = await base44.entities.Referral.filter({
        referrer_email: referrer.email,
        referred_email: bookingUser.email
      }).then(r => r[0]);
      
      if (!referralRecord) {
        console.log('⚠️ Referral record not found, creating one...');
        referralRecord = await base44.entities.Referral.create({
          referrer_email: referrer.email,
          referred_email: bookingUser.email,
          status: 'signed_up'
        });
      }
      
      if (referralRecord.status === 'booking_completed') {
        console.log('ℹ️ Referral reward already processed for this user\'s first booking.');
        return null;
      }
      
      const referralAmountNGN = bookingData.total_price * 0.05;
      
      console.log(`🎁 Awarding ₦${referralAmountNGN.toFixed(2)} referral earnings to ${referrer.email}`);
      
      const referrerNewBalance = (referrer.referral_balance_ngn || 0) + referralAmountNGN;
      
      await base44.entities.User.update(referrer.id, {
        referral_balance_ngn: referrerNewBalance
      });
      
      await base44.entities.Referral.update(referralRecord.id, {
        status: 'booking_completed',
        booking_id: bookingData.id,
        amount_earned_ngn: referralAmountNGN
      });
      
      console.log('✅ Referral reward processed successfully');
      
      return { referrerEmail: referrer.email, amountAwardedNGN: referralAmountNGN };
    } catch (error) {
      console.error('❌ Error processing referral reward:', error);
      return null;
    }
  };

  const logBookingToGoogleSheet = async (bookingId) => {
    try {
      console.log('📊 Logging booking to Google Sheet...');
      const response = await base44.functions.invoke('logBookingToGoogleSheet', {
        booking_id: bookingId
      });
      
      if (response.data && response.data.success) {
        console.log('✅ Successfully logged to Google Sheet');
      } else {
        console.error('⚠️ Failed to log to Google Sheet:', response.data?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Error logging to Google Sheet:', error);
    }
  };

  const handleSavePhoneNumber = async () => {
    setPhoneError('');
    
    // Validate phone number
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      setPhoneError('Please enter a valid phone number (at least 10 digits)');
      return;
    }
    
    setIsSavingPhone(true);
    try {
      await base44.auth.updateMe({ phone_number: phoneNumber.trim() });
      
      // Update local user state
      setUser(prev => ({ ...prev, phone_number: phoneNumber.trim() }));
      setShowPhoneNumberModal(false);
      
      console.log('✅ Phone number saved successfully');
    } catch (error) {
      console.error('❌ Error saving phone number:', error);
      setPhoneError('Failed to save phone number. Please try again.');
    }
    setIsSavingPhone(false);
  };

  const handleBooking = async () => {
    // Check if phone number is missing
    if (!user?.phone_number) {
      setShowPhoneNumberModal(true);
      return;
    }

    // If coming from a pre-approved booking, update it instead of creating new
    if (existingBooking) {
      setIsBooking(true);
      try {
        console.log('🚀 Completing pre-approved booking:', existingBooking.id);
        
        await base44.entities.Booking.update(existingBooking.id, {
          status: 'confirmed',
          payment_status: 'paid',
          payment_method: 'paystack'
        });
        
        const loyaltyResult = await awardBookingPoints(existingBooking);
        const referralResult = await processReferralReward(existingBooking, user);
        
        // Log to Google Sheet (fire-and-forget)
        logBookingToGoogleSheet(existingBooking.id);
        
        let successMessage = `🎉 Booking confirmed! You earned ${loyaltyResult.pointsEarned} Luxe Points!`;
        if (referralResult) {
          successMessage += `\n\n✨ Your referrer earned ₦${referralResult.amountAwardedNGN.toLocaleString()} thanks to you!`;
        }
        
        alert(successMessage);
        navigate(createPageUrl('Bookings'));
        
      } catch (error) {
        console.error('❌ Booking error:', error);
        alert('Failed to complete booking. Please try again.');
      }
      setIsBooking(false);
      return;
    }

    // Original flow for new bookings
    if (availabilityStatus !== 'available') {
      alert('Please check availability first before booking.');
      return;
    }

    if (!bookingDetails.checkIn || !bookingDetails.checkOut) {
      alert('Please select check-in and check-out dates');
      return;
    }

    if (!user || !user.email) {
      alert('User information is missing. Please log in again.');
      return;
    }

    setIsBooking(true);
    try {
      console.log('🚀 Starting Paystack booking process...');
      
      const bookingData = await base44.entities.Booking.create({
        property_id: property.id,
        guest_name: user.full_name || 'Guest User',
        guest_email: user.email,
        check_in: format(bookingDetails.checkIn, 'yyyy-MM-dd'),
        check_out: format(bookingDetails.checkOut, 'yyyy-MM-dd'),
        guests: bookingDetails.guests,
        total_price: totalPrice,
        special_requests: bookingDetails.specialRequests || '',
        status: 'confirmed',
        payment_status: 'paid',
        payment_method: 'paystack'
      });
      
      console.log('✅ Booking created:', bookingData.id);
      
      const loyaltyResult = await awardBookingPoints(bookingData);
      const referralResult = await processReferralReward(bookingData, user);
      
      // Log to Google Sheet (fire-and-forget, don't block user flow)
      logBookingToGoogleSheet(bookingData.id);
      
      let successMessage = `🎉 Booking confirmed! You earned ${loyaltyResult.pointsEarned} Luxe Points!`;
      if (referralResult) {
        successMessage += `\n\n✨ Your referrer earned ₦${referralResult.amountAwardedNGN.toLocaleString()} thanks to you!`;
      }
      
      alert(successMessage);
      navigate(createPageUrl('Bookings'));
      
    } catch (error) {
      console.error('❌ Booking error:', error);
      alert('Failed to complete booking. Please try again.');
    }
    setIsBooking(false);
  };

  // Load initial data
  useEffect(() => {
    loadCheckoutData();
  }, []);

  const loadCheckoutData = async () => {
    setIsLoading(true);
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      // Pre-fill phone number if exists
      if (userData.phone_number) {
        setPhoneNumber(userData.phone_number);
      }

      const params = new URLSearchParams(location.search);
      const bookingId = params.get('bookingId');
      const propertyId = params.get('property');
      const checkInStr = params.get('checkIn');
      const checkOutStr = params.get('checkOut');
      const guestsStr = params.get('guests');

      // Check if coming from a pre-approved booking
      if (bookingId) {
        console.log('📋 Loading pre-approved booking:', bookingId);
        const booking = await base44.entities.Booking.get(bookingId);
        setExistingBooking(booking);

        const propertyData = await base44.entities.Property.get(booking.property_id);
        setProperty(propertyData);

        setBookingDetails({
          checkIn: new Date(booking.check_in),
          checkOut: new Date(booking.check_out),
          guests: booking.guests,
          specialRequests: booking.special_requests || ''
        });

        // Pre-approved, so skip availability check
        setAvailabilityStatus('available');
        setAdminResponse('Your booking has been approved by admin. Complete payment to confirm.');
      } else {
        // Regular new booking flow
        if (!propertyId) {
          navigate(createPageUrl('Search'));
          return;
        }

        const propertyData = await base44.entities.Property.get(propertyId);
        setProperty(propertyData);

        const checkIn = checkInStr ? new Date(checkInStr) : null;
        const checkOut = checkOutStr ? new Date(checkOutStr) : null;
        const guests = guestsStr ? parseInt(guestsStr) : 2;

        setBookingDetails({
          checkIn,
          checkOut,
          specialRequests: '',
          guests
        });
      }

    } catch (error) {
      console.error('Error loading checkout data:', error);
      alert('Error loading checkout data. Please try again.');
      navigate(createPageUrl('Search'));
    }
    setIsLoading(false);
  };

  // Polling for approval (only for new bookings, not pre-approved ones)
  useEffect(() => {
    if (!availabilityRequestId || availabilityStatus !== 'pending' || existingBooking) {
      return;
    }

    console.log(`🔄 Starting polling for request: ${availabilityRequestId}`);
    
    const pollInterval = setInterval(async () => {
      try {
        console.log(`📡 Polling request ${availabilityRequestId}...`);
        const request = await base44.entities.AvailabilityRequest.get(availabilityRequestId);
        console.log(`📊 Status: ${request.status}`);
        
        if (request.status === 'approved') {
          console.log('✅ APPROVED - Updating state');
          
          clearInterval(pollInterval);
          
          setAvailabilityStatus('available');
          setAdminResponse(request.admin_response || 'Property is available for your dates!');
          setAvailabilityRequestId(null);
          setIsCheckingAvailability(false);
          setShowSuccessMessage(false);
          
          console.log('✅ State updated to AVAILABLE');
          
        } else if (request.status === 'rejected') {
          console.log('❌ REJECTED');
          
          clearInterval(pollInterval);
          
          setAvailabilityStatus('unavailable');
          setAdminResponse(request.admin_response || 'Property is not available for these dates.');
          setAvailabilityRequestId(null);
          setIsCheckingAvailability(false);
          setShowSuccessMessage(false);
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    }, 3000);

    return () => {
      console.log('🛑 Cleanup polling');
      clearInterval(pollInterval);
    };
  }, [availabilityRequestId, availabilityStatus, existingBooking]);

  // Calculate price breakdown
  useEffect(() => {
    if (bookingDetails.checkIn && bookingDetails.checkOut) {
      const nightCount = differenceInDays(bookingDetails.checkOut, bookingDetails.checkIn);
      setNights(nightCount);
      
      if (nightCount > 0 && property) {
        const subtotal = property.price_per_night * nightCount;
        const serviceFee = Math.round(subtotal * 0.025);
        const cautionFee = property.caution_fee || 0;
        const total = subtotal + serviceFee + cautionFee;
        
        setTotalPrice(total);
      } else {
        setTotalPrice(0);
      }
      
      // Don't reset availability status if coming from pre-approved booking
      if (!existingBooking) {
        setAvailabilityStatus('unknown');
        setAvailabilityError(null);
        setAdminResponse('');
        setShowSuccessMessage(false);
      }
    } else {
      setNights(0);
      setTotalPrice(0);
      if (!existingBooking) {
        setAvailabilityStatus('unknown');
        setAvailabilityError(null);
        setAdminResponse('');
        setShowSuccessMessage(false);
      }
    }
  }, [bookingDetails.checkIn, bookingDetails.checkOut, property, existingBooking]);

  const handleCheckAvailability = async () => {
    // Check if phone number is missing
    if (!user?.phone_number) {
      setShowPhoneNumberModal(true);
      return;
    }

    if (!bookingDetails.checkIn || !bookingDetails.checkOut) {
      alert('Please select both check-in and check-out dates.');
      return;
    }
    
    if (new Date(bookingDetails.checkOut) <= new Date(bookingDetails.checkIn)) {
      alert('Check-out date must be after the check-in date.');
      return;
    }

    console.log('=== CHECKING AVAILABILITY ===');
    console.log('📋 Booking Details:', {
      property_id: property.id,
      property_title: property.title,
      check_in: format(bookingDetails.checkIn, 'yyyy-MM-dd'),
      check_out: format(bookingDetails.checkOut, 'yyyy-MM-dd'),
      guests: bookingDetails.guests,
      user_email: user.email
    });

    setIsCheckingAvailability(true);
    setAvailabilityStatus('unknown');
    setAvailabilityRequestId(null);
    setAvailabilityError(null);
    setAdminResponse('');
    setShowSuccessMessage(false);

    try {
      // Step 1: Check for conflicts
      console.log('🔍 Step 1: Checking for booking conflicts...');
      const existingBookings = await base44.entities.Booking.filter({
        property_id: property.id,
        status: { $in: ['confirmed', 'pending'] }
      });

      const checkInDate = new Date(bookingDetails.checkIn);
      const checkOutDate = new Date(bookingDetails.checkOut);

      let hasConflict = false;
      let conflictingBooking = null;

      for (const booking of existingBookings) {
        const bookingCheckIn = new Date(booking.check_in);
        const bookingCheckOut = new Date(booking.check_out);

        if (
          (checkInDate >= bookingCheckIn && checkInDate < bookingCheckOut) ||
          (checkOutDate > bookingCheckIn && checkOutDate <= bookingCheckOut) ||
          (checkInDate <= bookingCheckIn && checkOutDate >= bookingCheckOut)
        ) {
          hasConflict = true;
          conflictingBooking = booking;
          console.log('⚠️ Conflict detected with existing booking:', booking.id);
          break;
        }
      }

      if (!hasConflict) {
        console.log('✅ No conflicts found');
      }

      // Step 2: Create AvailabilityRequest
      console.log('📝 Step 2: Creating AvailabilityRequest...');
      const request = await base44.entities.AvailabilityRequest.create({
        property_id: property.id,
        property_title: property.title,
        user_email: user.email,
        user_name: user.full_name || 'Guest User',
        check_in: format(bookingDetails.checkIn, 'yyyy-MM-dd'),
        check_out: format(bookingDetails.checkOut, 'yyyy-MM-dd'),
        guests: bookingDetails.guests,
        status: 'pending',
        has_conflict: hasConflict,
        conflict_details: hasConflict ? {
          booking_id: conflictingBooking.id,
          check_in: conflictingBooking.check_in,
          check_out: conflictingBooking.check_out,
          guest_email: conflictingBooking.guest_email
        } : null
      });

      console.log('✅ AvailabilityRequest created with ID:', request.id);
      
      // Step 3: Create pending Booking record
      console.log('📝 Step 3: Creating pending Booking record...');
      const pendingBooking = await base44.entities.Booking.create({
        property_id: property.id,
        guest_name: user.full_name || 'Guest User',
        guest_email: user.email,
        check_in: format(bookingDetails.checkIn, 'yyyy-MM-dd'),
        check_out: format(bookingDetails.checkOut, 'yyyy-MM-dd'),
        guests: bookingDetails.guests,
        total_price: totalPrice,
        special_requests: bookingDetails.specialRequests || '',
        status: 'pending',
        payment_status: 'unpaid'
      });

      console.log('✅ Pending Booking created with ID:', pendingBooking.id);
      setCreatedBookingId(pendingBooking.id);
      
      // Step 4: Update state and show success message
      setAvailabilityRequestId(request.id);
      setAvailabilityStatus('pending');
      setShowSuccessMessage(true);
      setIsCheckingAvailability(false);

      // Step 5: Send Telegram notification (non-blocking)
      console.log('📤 Step 4: Sending Telegram notification...');
      try {
        await base44.functions.invoke('sendTelegramNotification', {
          request_id: request.id,
          property_title: property.title,
          property_id: property.id,
          user_name: user.full_name || 'Guest User',
          user_email: user.email,
          check_in: format(bookingDetails.checkIn, 'yyyy-MM-dd'),
          check_out: format(bookingDetails.checkOut, 'yyyy-MM-dd'),
          guests: bookingDetails.guests,
          has_conflict: hasConflict
        });
        console.log('✅ Telegram notification sent successfully');
      } catch (telegramError) {
        console.error('⚠️ Failed to send Telegram notification:', telegramError);
        // Don't fail the entire process if Telegram fails
      }

      console.log('🎉 Availability check process completed successfully!');
      console.log('📊 Summary:', {
        availabilityRequestId: request.id,
        pendingBookingId: pendingBooking.id,
        hasConflict,
        status: 'pending'
      });

    } catch (error) {
      console.error('❌ Error during availability check:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      setAvailabilityError(error.message);
      setAvailabilityStatus('unknown');
      setIsCheckingAvailability(false);
      setShowSuccessMessage(false);
      alert('Could not check availability. Please try again or contact support.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-900 border-t-transparent"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="p-12 text-center">
          <p className="text-lg text-slate-600">Property not found.</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      {/* Phone Number Modal */}
      <Dialog open={showPhoneNumberModal} onOpenChange={setShowPhoneNumberModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-amber-600" />
              Phone Number Required
            </DialogTitle>
            <DialogDescription>
              Please provide your phone number to proceed with the booking. This is essential for booking confirmations and property communication.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="phone-modal">Phone Number *</Label>
              <Input
                id="phone-modal"
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  setPhoneError('');
                }}
                placeholder="+234 800 000 0000"
                className="mt-1"
                disabled={isSavingPhone}
              />
              {phoneError && (
                <p className="text-sm text-red-600 mt-1">{phoneError}</p>
              )}
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-900">
                <strong>📞 Important:</strong> Your phone number will be shared with the property owner for booking coordination and logged in our booking records.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPhoneNumberModal(false)}
              disabled={isSavingPhone}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePhoneNumber}
              disabled={isSavingPhone || !phoneNumber}
              className="bg-gradient-to-r from-slate-900 to-slate-800"
            >
              {isSavingPhone ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Continue'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Message for Pending Booking */}
      <AnimatePresence>
        {showSuccessMessage && availabilityStatus === 'pending' && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-lg w-full mx-4"
          >
            <Alert className="bg-green-50 border-green-200 shadow-2xl">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-900 font-bold">Request Submitted Successfully! 🎉</AlertTitle>
              <AlertDescription className="text-green-800">
                <div className="space-y-2 mt-2">
                  <p>Your booking request has been created and is now awaiting admin approval.</p>
                  <div className="flex gap-2 mt-3">
                    <Button 
                      size="sm" 
                      onClick={() => {
                        setShowSuccessMessage(false); // Dismiss message when navigating
                        navigate(createPageUrl('Bookings'));
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      View in Pending Approvals
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowSuccessMessage(false)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto">
        {/* Approval Banner */}
        <AnimatePresence>
          {availabilityStatus === 'available' && adminResponse && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4 bg-green-500 text-white p-4 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold mb-1">✅ Approved!</p>
                  <p className="text-sm">{adminResponse}</p>
                </div>
              </div>
            </motion.div>
          )}
          
          {availabilityStatus === 'unavailable' && adminResponse && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4 bg-red-500 text-white p-4 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold mb-1">❌ Not Available</p>
                  <p className="text-sm">{adminResponse}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
            disabled={isBooking}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Complete Your Booking</h1>
            <p className="text-slate-600">You're just steps away from your perfect stay.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Property Card */}
          <div className="space-y-6">
            <Card className="bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-lg overflow-hidden">
              <img
                src={property.images?.[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'}
                alt={property.title}
                className="w-full h-64 object-cover"
              />
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{property.title}</h2>
                <div className="flex items-center gap-2 text-slate-600 mb-4">
                  <MapPin className="w-4 h-4" />
                  <span>{property.location?.city}, {property.location?.country}</span>
                </div>
                <p className="text-slate-700">{property.description}</p>
              </CardContent>
            </Card>
          </div>

          {/* Booking Form */}
          <div className="space-y-6">
            <Card className="bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-lg">
              <CardHeader>
                <CardTitle>Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Check-in Date</Label>
                    <Input
                      type="date"
                      value={bookingDetails.checkIn ? format(bookingDetails.checkIn, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        setBookingDetails(prev => ({ ...prev, checkIn: e.target.value ? new Date(e.target.value) : null }));
                      }}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      className="mt-1"
                      disabled={isBooking || isCheckingAvailability || availabilityStatus === 'pending' || existingBooking}
                    />
                  </div>
                  <div>
                    <Label>Check-out Date</Label>
                    <Input
                      type="date"
                      value={bookingDetails.checkOut ? format(bookingDetails.checkOut, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        setBookingDetails(prev => ({ ...prev, checkOut: e.target.value ? new Date(e.target.value) : null }));
                      }}
                      min={bookingDetails.checkIn ? format(new Date(new Date(bookingDetails.checkIn).getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                      className="mt-1"
                      disabled={isBooking || isCheckingAvailability || availabilityStatus === 'pending' || existingBooking}
                    />
                  </div>
                </div>

                <div>
                  <Label>Number of Guests</Label>
                  <Input
                    type="number"
                    value={bookingDetails.guests}
                    onChange={(e) => setBookingDetails(prev => ({ ...prev, guests: parseInt(e.target.value) || 1 }))}
                    min="1"
                    max={property.max_guests}
                    className="mt-1"
                    disabled={isBooking || isCheckingAvailability || availabilityStatus === 'pending' || existingBooking}
                  />
                </div>

                <div>
                  <Label>Special Requests</Label>
                  <Textarea
                    placeholder="Any special requests or preferences..."
                    value={bookingDetails.specialRequests}
                    onChange={(e) => setBookingDetails(prev => ({ ...prev, specialRequests: e.target.value }))}
                    className="mt-1"
                    disabled={isBooking || isCheckingAvailability || availabilityStatus === 'pending' || existingBooking}
                  />
                </div>

                {/* Availability Section - only for new bookings */}
                {!existingBooking && (
                  <div className="pt-4 border-t border-slate-200">
                    {availabilityStatus !== 'available' && (
                      <Button
                        onClick={handleCheckAvailability}
                        disabled={isCheckingAvailability || !bookingDetails.checkIn || !bookingDetails.checkOut || isBooking || availabilityStatus === 'pending'}
                        variant="outline"
                        className="w-full mb-3"
                      >
                        {availabilityStatus === 'pending' ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-pulse" />
                            Awaiting Admin Approval...
                          </>
                        ) : isCheckingAvailability ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending Request...
                          </>
                        ) : (
                          <>
                            <Calendar className="w-4 h-4 mr-2" />
                            Check Availability
                          </>
                        )}
                      </Button>
                    )}

                    {availabilityStatus === 'pending' && !showSuccessMessage && (
                      <div className="flex items-start gap-3 text-amber-600 bg-amber-50 border border-amber-200 p-4 rounded-xl mb-3">
                        <Clock className="w-5 h-5 animate-pulse flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-sm mb-1">⏳ Awaiting Admin Approval</p>
                          <p className="text-xs">Your request is being reviewed. You can track it in the "Pending Approval" tab of your bookings!</p>
                        </div>
                      </div>
                    )}

                    {availabilityStatus === 'available' && (
                      <div className="flex items-center gap-2 text-green-600 bg-green-50 border-2 border-green-200 p-4 rounded-xl mb-3">
                        <CheckCircle className="w-6 h-6" />
                        <span className="font-bold">✅ APPROVED! Ready to book</span>
                      </div>
                    )}

                    {availabilityStatus === 'unavailable' && (
                      <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg mb-3">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">❌ Not available. Try different dates.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Price Summary */}
                {nights > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                    <div className="flex justify-between">
                      <span>₦{property.price_per_night.toLocaleString()} × {nights} nights</span>
                      <span>₦{(property.price_per_night * nights).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service Fee (2.5%)</span>
                      <span>₦{Math.round(property.price_per_night * nights * 0.025).toLocaleString()}</span>
                    </div>
                    {property.caution_fee > 0 && (
                      <div className="flex justify-between items-center py-2 px-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-900">Refundable Caution Fee</span>
                        </div>
                        <span className="font-semibold text-amber-900">₦{property.caution_fee.toLocaleString()}</span>
                      </div>
                    )}
                    <hr className="border-slate-200" />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>₦{totalPrice.toLocaleString()}</span>
                    </div>
                    {property.caution_fee > 0 && (
                      <p className="text-xs text-amber-700 mt-2">
                        * Caution fee of ₦{property.caution_fee.toLocaleString()} will be fully refunded after checkout inspection
                      </p>
                    )}
                  </div>
                )}

                {/* Payment Info */}
                {availabilityStatus === 'available' && nights > 0 && (
                  <div className="pt-4">
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4 text-sm">
                      <p className="font-semibold mb-2 text-green-900">💳 Secure Payment with Paystack</p>
                      <p className="text-green-800">Fast, secure, and reliable payment processing for Nigerian users.</p>
                    </div>
                  </div>
                )}

                {/* Payment Button */}
                <Button
                  onClick={handleBooking}
                  disabled={availabilityStatus !== 'available' || nights <= 0 || isBooking}
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${
                    availabilityStatus === 'available' && nights > 0
                      ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing Payment...
                    </>
                  ) : availabilityStatus !== 'available' ? (
                    existingBooking ? 'Loading...' : 'Check Availability First'
                  ) : (
                    <>
                      Complete Payment (₦{totalPrice.toLocaleString()})
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
