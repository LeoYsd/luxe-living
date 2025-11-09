
import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { UploadFile } from '@/integrations/Core';
import { SupportTicket } from '@/entities/SupportTicket';
import { SupportMessage } from '@/entities/SupportMessage';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Database,
  Shield,
  Eye,
  Image as ImageIcon,
  Trash2,
  Video,
  Play,
  MessageSquare,
  Send,
  Loader2,
  Edit,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [progress, setProgress] = useState(0);

  // Support Inbox State
  const [supportTickets, setSupportTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [adminReply, setAdminReply] = useState("");
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);

  // New state for manual form entry
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [propertyFormData, setPropertyFormData] = useState({
    title: '',
    description: '',
    city: '',
    country: '',
    address: '',
    price_per_night: '',
    currency: 'USD',
    max_guests: '',
    bedrooms: '',
    bathrooms: '',
    property_type: 'apartment',
    amenities: '',
    images: [],
    videos: [],
    rating: '',
    reviews_count: '',
    host_name: '',
    instant_book: false
  });
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingVideos, setIsUploadingVideos] = useState(false);

  // New state for "Delete All Properties"
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [activeTab, setActiveTab] = useState('data-ingestion');
  const [isSyncing, setIsSyncing] = useState(false);

  // NEW: MCP Data Fetch State
  const [mcpCity, setMcpCity] = useState('');
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpResult, setMcpResult] = useState(null);

  // NEW: Property Management State
  const [propertiesList, setPropertiesList] = useState([]);
  const [isPropertiesLoading, setIsPropertiesLoading] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [deletingPropertyId, setDeletingPropertyId] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState(null);


  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAuthorized) {
        loadSupportTickets();
        loadProperties();
    }
  }, [isAuthorized]);

  const checkAdminAccess = async () => {
    setIsLoading(true);
    try {
      const userData = await User.me();
      setUser(userData);

      // Check if user has admin role
      if (userData.role === 'admin') {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      setIsAuthorized(false);
      setUser(null); // Ensure user is null if access check fails (e.g., not logged in)
    }
    setIsLoading(false);
  };

  const loadSupportTickets = async () => {
    setIsLoadingTickets(true);
    try {
        const tickets = await SupportTicket.filter({}, '-created_date');
        setSupportTickets(tickets);
    } catch (error) {
        console.error("Failed to load support tickets:", error);
        alert("Failed to load support tickets.");
    }
    setIsLoadingTickets(false);
  };

  // NEW: Load Properties Function
  const loadProperties = async () => {
    setIsPropertiesLoading(true);
    try {
      const allProperties = await base44.entities.Property.list({}, '-created_date', 100); // Fetch up to 100 properties
      setPropertiesList(allProperties);
    } catch (error) {
      console.error("Failed to load properties:", error);
      alert("Failed to load properties.");
    }
    setIsPropertiesLoading(false);
  };

  // NEW: Handle Edit Property
  const handleEditProperty = (property) => {
    setEditingProperty(property);
    setPropertyFormData({
      title: property.title || '',
      description: property.description || '',
      city: property.location?.city || '',
      country: property.location?.country || '',
      address: property.location?.address || '',
      price_per_night: property.price_per_night || '',
      currency: property.currency || 'USD',
      max_guests: property.max_guests || '',
      bedrooms: property.bedrooms || '',
      bathrooms: property.bathrooms || '',
      property_type: property.property_type || 'apartment',
      amenities: property.amenities ? property.amenities.join(', ') : '',
      images: property.images || [],
      videos: property.videos || [],
      rating: property.rating || '',
      reviews_count: property.reviews_count || '',
      host_name: property.host_name || '',
      instant_book: property.instant_book || false
    });
    setShowPropertyForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to the form
  };

  // NEW: Handle Delete Click
  const handleDeleteClick = (property) => {
    setPropertyToDelete(property);
    setShowDeleteDialog(true);
  };

  // NEW: Confirm Delete Property
  const handleConfirmDelete = async () => {
    if (!propertyToDelete) return;

    setDeletingPropertyId(propertyToDelete.id);
    try {
      await base44.entities.Property.delete(propertyToDelete.id);
      await loadProperties();
      alert('Property deleted successfully!');
    } catch (error) {
      console.error("Failed to delete property:", error);
      alert("Failed to delete property. Please try again.");
    } finally {
      setDeletingPropertyId(null);
      setShowDeleteDialog(false);
      setPropertyToDelete(null);
    }
  };

  const handleSelectTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setTicketMessages([]); // Clear previous messages
    try {
        const messages = await SupportMessage.filter({ ticket_id: ticket.id }, 'created_date');
        setTicketMessages(messages);
    } catch (error) {
        console.error(`Failed to load messages for ticket ${ticket.id}:`, error);
        alert("Failed to load ticket messages.");
    }
  };

  const handleSendAdminReply = async () => {
    if (!adminReply.trim() || !selectedTicket) return;

    setIsSendingReply(true);
    try {
        await SupportMessage.create({
            ticket_id: selectedTicket.id,
            sender_type: 'human_agent',
            message: adminReply,
            message_type: 'text'
        });
        
        if (selectedTicket.status === 'open') {
            await SupportTicket.update(selectedTicket.id, { status: 'in_progress' });
        }

        setAdminReply("");
        const updatedTicket = { ...selectedTicket, status: selectedTicket.status === 'open' ? 'in_progress' : selectedTicket.status };
        await handleSelectTicket(updatedTicket);
        await loadSupportTickets();
    } catch (error) {
        console.error("Failed to send reply:", error);
        alert("Failed to send reply.");
    }
    setIsSendingReply(false);
  };
  
  const handleUpdateTicketStatus = async (newStatus) => {
    if (!selectedTicket) return;
    try {
        const updatedTicket = await SupportTicket.update(selectedTicket.id, { status: newStatus });
        await loadSupportTickets();
        setSelectedTicket(prev => ({ ...prev, status: newStatus }));
    } catch (error) {
        console.error("Failed to update ticket status:", error);
        alert("Failed to update status.");
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      alert('Please upload a CSV or Excel file only.');
      return;
    }

    setIsUploading(true);
    setProgress(10);
    setExtractedData(null); // Clear previous data
    setImportResults(null); // Clear previous results

    try {
      const uploadResult = await UploadFile({ file });
      setUploadedFile({
        name: file.name,
        size: file.size,
        url: uploadResult.file_url
      });
      setProgress(100);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    }

    setIsUploading(false);
  };

  const processUploadedFile = async () => {
    if (!uploadedFile) return;

    setIsProcessing(true);
    setProgress(0);
    setImportResults(null); // Clear previous results

    try {
      // Define the expected schema for property data
      const propertySchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            city: { type: "string" },
            country: { type: "string" },
            address: { type: "string" },
            price_per_night: { type: "number" },
            max_guests: { type: "number" },
            bedrooms: { type: "number" },
            bathrooms: { type: "number" },
            property_type: { type: "string" },
            amenities: { type: "string" }, // Comma-separated string
            images: { type: "string" }, // Comma-separated URLs
            rating: { type: "number" },
            reviews_count: { type: "number" },
            host_name: { type: "string" },
            instant_book: { type: "boolean" }
          },
          required: ["title", "city", "country", "price_per_night", "max_guests", "property_type"]
        }
      };

      setProgress(30);

      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: uploadedFile.url,
        json_schema: propertySchema
      });

      setProgress(60);

      if (extractResult.status === 'success') {
        // Transform and validate the data
        const transformedData = extractResult.output.map(item => ({
          title: item.title,
          description: item.description || '',
          location: {
            city: item.city,
            country: item.country,
            address: item.address || '',
            coordinates: { lat: 0, lng: 0 } // Default coordinates
          },
          price_per_night: Number(item.price_per_night),
          currency: 'USD', // Explicitly set to USD for file imports
          max_guests: Number(item.max_guests),
          bedrooms: Number(item.bedrooms) || 1,
          bathrooms: Number(item.bathrooms) || 1,
          property_type: item.property_type.toLowerCase(),
          amenities: item.amenities ? item.amenities.split(',').map(a => a.trim().toLowerCase()) : [],
          images: item.images ? item.images.split(',').map(url => url.trim()) : [],
          rating: Number(item.rating) || 0,
          reviews_count: Number(item.reviews_count) || 0,
          host_name: item.host_name || '',
          instant_book: Boolean(item.instant_book),
          source: 'file_upload'
        }));

        setExtractedData(transformedData);
        setProgress(100);
      } else {
        throw new Error(extractResult.details || 'Failed to extract data from file');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert(`Error processing file: ${error.message}`);
      setExtractedData(null); // Clear extracted data on error
    }

    setIsProcessing(false);
  };

  const importPropertiesToDatabase = async () => {
    if (!extractedData || extractedData.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    try {
      for (let i = 0; i < extractedData.length; i++) {
        try {
          await base44.entities.Property.create(extractedData[i]);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: ${error.message}`);
        }

        setProgress(((i + 1) / extractedData.length) * 100);
      }

      setImportResults(results);
      setExtractedData(null); // Clear extracted data after import
      await loadProperties(); // Refresh the property list
    } catch (error) {
      console.error('Error importing properties:', error);
      alert('Error during import process.');
    }

    setIsProcessing(false);
  };

  const downloadSampleCSV = () => {
    const sampleData = `title,description,city,country,address,price_per_night,max_guests,bedrooms,bathrooms,property_type,amenities,images,rating,reviews_count,host_name,instant_book
"Luxury Downtown Apartment","Beautiful apartment in the heart of the city","Lagos","Nigeria","123 Main St",150,4,2,2,"apartment","wifi,kitchen,parking","https://example.com/image1.jpg",4.5,120,"John Doe",true
"Cozy Beach Villa","Stunning villa with ocean views","Accra","Ghana","456 Beach Ave",350,6,3,3,"villa","wifi,pool,balcony","https://example.com/image2.jpg",4.8,85,"Jane Smith",false`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'property_data_sample.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const handlePropertyFormSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingForm(true);

    try {
      // Transform form data to match Property entity structure
      const propertyData = {
        title: propertyFormData.title,
        description: propertyFormData.description,
        location: {
          city: propertyFormData.city,
          country: propertyFormData.country,
          address: propertyFormData.address,
          coordinates: { lat: 0, lng: 0 } // Default coordinates
        },
        price_per_night: Number(propertyFormData.price_per_night),
        currency: propertyFormData.currency, // Use selected currency
        max_guests: Number(propertyFormData.max_guests),
        bedrooms: Number(propertyFormData.bedrooms) || 1,
        bathrooms: Number(propertyFormData.bathrooms) || 1,
        property_type: propertyFormData.property_type,
        amenities: propertyFormData.amenities ? propertyFormData.amenities.split(',').map(a => a.trim().toLowerCase()) : [],
        images: propertyFormData.images,
        videos: propertyFormData.videos,
        rating: Number(propertyFormData.rating) || 0,
        reviews_count: Number(propertyFormData.reviews_count) || 0,
        host_name: propertyFormData.host_name || '',
        instant_book: propertyFormData.instant_book,
        source: editingProperty ? editingProperty.source : 'manual'
      };

      if (editingProperty) {
        // Update existing property
        await base44.entities.Property.update(editingProperty.id, propertyData);
        alert('Property updated successfully!');
      } else {
        // Create new property
        await base44.entities.Property.create(propertyData);
        alert('Property added successfully!');
      }
      
      // Reset form
      setPropertyFormData({
        title: '', description: '', city: '', country: '', address: '', price_per_night: '', currency: 'USD', max_guests: '', bedrooms: '', bathrooms: '', property_type: 'apartment', amenities: '', images: [], videos: [], rating: '', reviews_count: '', host_name: '', instant_book: false
      });
      setEditingProperty(null); // Clear editing state
      setShowPropertyForm(false);
      await loadProperties(); // Refresh the property list
      
    } catch (error) {
      console.error('Error saving property:', error);
      alert('Failed to save property. Please try again.');
    }
    
    setIsSubmittingForm(false);
  };

  const handleFormInputChange = (field, value) => {
    setPropertyFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleImageUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    const uploadedUrls = [];

    for (const file of Array.from(files)) { // Convert FileList to Array
        if (!file.type.startsWith('image/')) {
            alert(`Skipping non-image file: ${file.name}`);
            continue;
        }
        try {
            const uploadResult = await UploadFile({ file });
            uploadedUrls.push(uploadResult.file_url);
        } catch (error) {
            console.error('Error uploading image:', error);
            alert(`Failed to upload ${file.name}. Please try again.`);
        }
    }

    setPropertyFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
    }));
    setIsUploadingImages(false);
    // Clear the input value so the same file can be selected again
    event.target.value = '';
  };

  const handleVideoUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingVideos(true);
    const uploadedUrls = [];

    for (const file of Array.from(files)) {
        if (!file.type.startsWith('video/')) {
            alert(`Skipping non-video file: ${file.name}`);
            continue;
        }
        
        // Check file size (limit to 100MB for videos)
        if (file.size > 100 * 1024 * 1024) {
            alert(`Video ${file.name} is too large. Please upload videos smaller than 100MB.`);
            continue;
        }
        
        try {
            const uploadResult = await UploadFile({ file });
            uploadedUrls.push(uploadResult.file_url);
        } catch (error) {
            console.error('Error uploading video:', error);
            alert(`Failed to upload ${file.name}. Please try again.`);
        }
    }

    setPropertyFormData(prev => ({
        ...prev,
        videos: [...prev.videos, ...uploadedUrls]
    }));
    setIsUploadingVideos(false);
    // Clear the input value so the same file can be selected again
    event.target.value = '';
  };

  const handleRemoveImage = (urlToRemove) => {
    setPropertyFormData(prev => ({
        ...prev,
        images: prev.images.filter(url => url !== urlToRemove)
    }));
  };

  const handleRemoveVideo = (urlToRemove) => {
    setPropertyFormData(prev => ({
        ...prev,
        videos: prev.videos.filter(url => url !== urlToRemove)
    }));
  };

  const handleDeleteAllProperties = async () => {
    const confirmation = window.confirm(
      'DANGER: Are you sure you want to permanently delete ALL properties from the database? This action cannot be undone.'
    );

    if (confirmation) {
      setIsDeleting(true);
      try {
        // Fetch all properties from the frontend
        const allProperties = await base44.entities.Property.list();
        const count = allProperties.length;

        if (count === 0) {
          alert("There are no properties to delete.");
          setIsDeleting(false);
          return;
        }

        // Loop through and delete each property one by one
        for (const prop of allProperties) {
          await base44.entities.Property.delete(prop.id);
        }

        alert(`Success! ${count} properties have been deleted.`);
        await loadProperties(); // Refresh the property list
      } catch (error) {
        console.error('Failed to delete properties:', error);
        alert(`Error: ${error.message}`);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // NEW: MCP Data Fetch Function
  const handleMCPFetch = async () => {
    if (!mcpCity.trim()) {
      alert('Please enter a city name');
      return;
    }

    setMcpLoading(true);
    setMcpResult(null);

    try {
      console.log('Calling MCP function with city:', mcpCity);
      const response = await base44.functions.invoke('mcpDataIngestion', {
        city: mcpCity,
        sources: ['airbnb']
      });

      console.log('MCP Response:', response);
      setMcpResult({
        success: response.data.success,
        message: response.data.message || (response.data.success ? 'Properties fetched successfully!' : 'Failed to fetch properties.'),
        errors: response.data.errors || []
      });
      
      if (response.data.success) {
        await loadProperties(); // Refresh the property list after successful fetch
      }
    } catch (error) {
      console.error('MCP Error:', error);
      setMcpResult({ 
        success: false, 
        message: error.message || error.toString()
      });
    }

    setMcpLoading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-900 border-t-transparent"></div>
      </div>
    );
  }

  // New check for unauthenticated users
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-8">
        <Card className="max-w-md w-full bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-xl">
          <CardContent className="p-12 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Authentication Required</h2>
            <p className="text-slate-600 mb-6">
              Please log in to access the admin panel.
            </p>
            <Button onClick={() => window.location.reload()} className="bg-slate-900 hover:bg-slate-800">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Existing check for unauthorized users (not admin)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-8">
        <Card className="max-w-md w-full bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-xl">
          <CardContent className="p-12 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h2>
            <p className="text-slate-600 mb-6">
              You need administrator privileges to access this page.
            </p>
            <p className="text-sm text-slate-500">
              Current role: {user.role || 'user'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-8 h-8 text-slate-900" />
            <h1 className="text-3xl font-bold text-slate-900">Property Data Admin</h1>
            <Badge className="bg-red-100 text-red-800 border-red-200">Admin Only</Badge>
          </div>
          <p className="text-slate-600 text-lg">Manage property data via CSV import or manual entry</p>
        </div>

        {/* MCP Data Fetch Tool */}
        <Card className="bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Fetch Live Properties (Airbnb)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rate Limit Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-900 mb-1">⚠️ API Rate Limits Apply</p>
                  <p className="text-amber-700">
                    The Airbnb API has daily/monthly limits. If you get a <strong>429 error</strong>, 
                    your rate limit has been reached. Check your{' '}
                    <a 
                      href="https://rapidapi.com/developer/dashboard" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-amber-900"
                    >
                      RapidAPI Dashboard
                    </a>
                    {' '}for usage details.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="mcp-city">City Name</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="mcp-city"
                  value={mcpCity}
                  onChange={(e) => setMcpCity(e.target.value)}
                  placeholder="e.g., London, Paris, New York"
                  className="rounded-xl"
                />
                <Button
                  onClick={handleMCPFetch}
                  disabled={mcpLoading}
                  className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                >
                  {mcpLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2" />
                      Fetching...
                    </>
                  ) : (
                    'Fetch Properties'
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Fetches live property listings from Airbnb and saves them to your database
              </p>
            </div>

            {mcpResult && (
              <div className={`p-4 rounded-xl ${
                mcpResult.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                {mcpResult.success ? (
                  <div>
                    <p className="font-semibold text-green-900 mb-2">✅ Success!</p>
                    <p className="text-sm text-green-800">{mcpResult.message}</p>
                    {mcpResult.errors && mcpResult.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-green-700 cursor-pointer">View errors ({mcpResult.errors.length})</summary>
                        <pre className="text-xs mt-2 overflow-auto max-h-32 text-green-700">
                          {mcpResult.errors.join('\n')}
                        </pre>
                      </details>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-red-900 mb-2">❌ Failed</p>
                    <p className="text-sm text-red-800">{mcpResult.message}</p>
                    
                    {/* Specific guidance for 429 errors */}
                    {mcpResult.message?.includes('429') && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs font-semibold text-amber-900 mb-1">💡 Rate Limit Reached</p>
                        <p className="text-xs text-amber-800">
                          You've exceeded your API quota. Solutions:
                        </p>
                        <ul className="text-xs text-amber-800 list-disc list-inside mt-1 space-y-1">
                          <li>Wait for your rate limit to reset (check RapidAPI dashboard)</li>
                          <li>Upgrade your RapidAPI plan for more requests</li>
                          <li>Use existing database properties (Search page)</li>
                          <li>Add properties manually (form below)</li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Property Entry Form */}
        <Card className="bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-lg mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {editingProperty ? 'Edit Property' : 'Manual Property Entry'}
              </CardTitle>
              <Button
                onClick={() => {
                  setShowPropertyForm(!showPropertyForm);
                  if (showPropertyForm) { // If closing the form, clear data and editing state
                    setPropertyFormData({
                      title: '', description: '', city: '', country: '', address: '', price_per_night: '', currency: 'USD', max_guests: '', bedrooms: '', bathrooms: '', property_type: 'apartment', amenities: '', images: [], videos: [], rating: '', reviews_count: '', host_name: '', instant_book: false
                    });
                    setEditingProperty(null);
                  }
                }}
                variant={showPropertyForm ? "outline" : "default"}
                className={`${showPropertyForm ? 'border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600' : 'bg-green-600 hover:bg-green-700 text-white'}`}
              >
                {showPropertyForm ? 'Close Form' : 'Add Property Manually'}
              </Button>
            </div>
          </CardHeader>
          
          <AnimatePresence>
          {showPropertyForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent>
                {editingProperty && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                    <p className="text-sm text-blue-900">
                      <strong>Editing:</strong> {editingProperty.title}
                    </p>
                  </div>
                )}
                <form onSubmit={handlePropertyFormSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title" className="text-sm font-semibold text-slate-700">
                        Title *
                      </Label>
                      <Input
                        id="title"
                        value={propertyFormData.title}
                        onChange={(e) => handleFormInputChange('title', e.target.value)}
                        placeholder="Property title"
                        required
                        className="mt-2 rounded-xl border-slate-200"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="property_type" className="text-sm font-semibold text-slate-700">
                        Property Type *
                      </Label>
                      <select
                        id="property_type"
                        value={propertyFormData.property_type}
                        onChange={(e) => handleFormInputChange('property_type', e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="apartment">Apartment</option>
                        <option value="house">House</option>
                        <option value="studio">Studio</option>
                        <option value="loft">Loft</option>
                        <option value="penthouse">Penthouse</option>
                        <option value="villa">Villa</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm font-semibold text-slate-700">
                      Description
                    </Label>
                    <textarea
                      id="description"
                      value={propertyFormData.description}
                      onChange={(e) => handleFormInputChange('description', e.target.value)}
                      placeholder="Property description"
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city" className="text-sm font-semibold text-slate-700">
                        City *
                      </Label>
                      <Input
                        id="city"
                        value={propertyFormData.city}
                        onChange={(e) => handleFormInputChange('city', e.target.value)}
                        placeholder="City"
                        required
                        className="mt-2 rounded-xl border-slate-200"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="country" className="text-sm font-semibold text-slate-700">
                        Country *
                      </Label>
                      <Input
                        id="country"
                        value={propertyFormData.country}
                        onChange={(e) => handleFormInputChange('country', e.target.value)}
                        placeholder="Country"
                        required
                        className="mt-2 rounded-xl border-slate-200"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="address" className="text-sm font-semibold text-slate-700">
                        Address
                      </Label>
                      <Input
                        id="address"
                        value={propertyFormData.address}
                        onChange={(e) => handleFormInputChange('address', e.target.value)}
                        placeholder="Full address"
                        className="mt-2 rounded-xl border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="price_per_night" className="text-sm font-semibold text-slate-700">
                        Price per Night *
                      </Label>
                      <div className="flex items-center gap-2 mt-2">
                          <Input
                            id="price_per_night"
                            type="number"
                            value={propertyFormData.price_per_night}
                            onChange={(e) => handleFormInputChange('price_per_night', e.target.value)}
                            placeholder="150"
                            required
                            className="rounded-xl border-slate-200"
                          />
                          <Select
                            value={propertyFormData.currency}
                            onValueChange={(value) => handleFormInputChange('currency', value)}
                          >
                            <SelectTrigger className="w-[120px] rounded-xl border-slate-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD ($)</SelectItem>
                              <SelectItem value="NGN">NGN (₦)</SelectItem>
                            </SelectContent>
                          </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="max_guests" className="text-sm font-semibold text-slate-700">
                        Max Guests *
                      </Label>
                      <Input
                        id="max_guests"
                        type="number"
                        value={propertyFormData.max_guests}
                        onChange={(e) => handleFormInputChange('max_guests', e.target.value)}
                        placeholder="4"
                        required
                        className="mt-2 rounded-xl border-slate-200"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="bedrooms" className="text-sm font-semibold text-slate-700">
                        Bedrooms
                      </Label>
                      <Input
                        id="bedrooms"
                        type="number"
                        value={propertyFormData.bedrooms}
                        onChange={(e) => handleFormInputChange('bedrooms', e.target.value)}
                        placeholder="2"
                        className="mt-2 rounded-xl border-slate-200"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="bathrooms" className="text-sm font-semibold text-slate-700">
                        Bathrooms
                      </Label>
                      <Input
                        id="bathrooms"
                        type="number"
                        value={propertyFormData.bathrooms}
                        onChange={(e) => handleFormInputChange('bathrooms', e.target.value)}
                        placeholder="1"
                        className="mt-2 rounded-xl border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="rating" className="text-sm font-semibold text-slate-700">
                        Rating (0-5)
                      </Label>
                      <Input
                        id="rating"
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={propertyFormData.rating}
                        onChange={(e) => handleFormInputChange('rating', e.target.value)}
                        placeholder="4.5"
                        className="mt-2 rounded-xl border-slate-200"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="reviews_count" className="text-sm font-semibold text-slate-700">
                        Reviews Count
                      </Label>
                      <Input
                        id="reviews_count"
                        type="number"
                        value={propertyFormData.reviews_count}
                        onChange={(e) => handleFormInputChange('reviews_count', e.target.value)}
                        placeholder="120"
                        className="mt-2 rounded-xl border-slate-200"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="host_name" className="text-sm font-semibold text-slate-700">
                        Host Name
                      </Label>
                      <Input
                        id="host_name"
                        value={propertyFormData.host_name}
                        onChange={(e) => handleFormInputChange('host_name', e.target.value)}
                        placeholder="John Doe"
                        className="mt-2 rounded-xl border-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="amenities" className="text-sm font-semibold text-slate-700">
                      Amenities (comma-separated)
                    </Label>
                    <Input
                      id="amenities"
                      value={propertyFormData.amenities}
                      onChange={(e) => handleFormInputChange('amenities', e.target.value)}
                      placeholder="wifi, kitchen, parking, pool, gym, balcony"
                      className="mt-2 rounded-xl border-slate-200"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Available: wifi, kitchen, parking, pool, gym, balcony, air_conditioning, heating, washer, dryer, pets_allowed, smoking_allowed, workspace
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="image-upload" className="text-sm font-semibold text-slate-700">
                      Property Images
                    </Label>
                    <div className="mt-2 flex items-center gap-4">
                      <Input
                        id="image-upload"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploadingImages}
                        className="flex-1 rounded-xl border-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                      />
                      {isUploadingImages && (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-slate-900" />
                      )}
                    </div>
                    {propertyFormData.images.length > 0 && (
                      <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                        {propertyFormData.images.map((url, index) => (
                          <div key={index} className="relative group aspect-square">
                            <img src={url} alt={`Property image ${index + 1}`} className="w-full h-full object-cover rounded-xl shadow-md" />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(url)}
                              className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="video-upload" className="text-sm font-semibold text-slate-700">
                      Property Videos
                    </Label>
                    <div className="mt-2 flex items-center gap-4">
                      <Input
                        id="video-upload"
                        type="file"
                        multiple
                        accept="video/*"
                        onChange={handleVideoUpload}
                        disabled={isUploadingVideos}
                        className="flex-1 rounded-xl border-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                      />
                      {isUploadingVideos && (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-slate-900" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Supported formats: MP4, WebM, AVI, MOV (Max size: 100MB per video)
                    </p>
                    {propertyFormData.videos.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {propertyFormData.videos.map((url, index) => (
                          <div key={index} className="relative group aspect-video">
                            <video 
                              src={url} 
                              className="w-full h-full object-cover rounded-xl shadow-md"
                              controls={false}
                              preload="metadata"
                            />
                            <div className="absolute inset-0 bg-black/20 rounded-xl flex items-center justify-center">
                              <Play className="w-8 h-8 text-white opacity-80" />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveVideo(url)}
                              className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="instant_book"
                      checked={propertyFormData.instant_book}
                      onChange={(e) => handleFormInputChange('instant_book', e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 shadow-sm focus:ring-blue-500"
                    />
                    <Label htmlFor="instant_book" className="text-sm font-semibold text-slate-700">
                      Instant Book Available
                    </Label>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPropertyForm(false);
                        setEditingProperty(null); // Clear editing state on cancel
                        setPropertyFormData({ // Reset form data
                          title: '', description: '', city: '', country: '', address: '', price_per_night: '', currency: 'USD', max_guests: '', bedrooms: '', bathrooms: '', property_type: 'apartment', amenities: '', images: [], videos: [], rating: '', reviews_count: '', host_name: '', instant_book: false
                        });
                      }}
                      disabled={isSubmittingForm}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmittingForm || isUploadingImages || isUploadingVideos}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSubmittingForm ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2" />
                          {editingProperty ? 'Updating...' : 'Adding Property...'}
                        </>
                      ) : (
                        editingProperty ? 'Update Property' : 'Add Property'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </motion.div>
          )}
          </AnimatePresence>
        </Card>

        {/* NEW: Property Management List */}
        <Card className="bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-lg mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <List className="w-5 h-5" />
                Property Management ({propertiesList.length} properties)
              </CardTitle>
              <Button
                onClick={loadProperties}
                disabled={isPropertiesLoading}
                variant="outline"
                size="sm"
              >
                {isPropertiesLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Refresh List'
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isPropertiesLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-400" />
                <p className="text-slate-500">Loading properties...</p>
              </div>
            ) : propertiesList.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Database className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No properties found.</p>
                <p className="text-sm mt-2">Add properties using the forms above or refresh the list.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b-2 border-slate-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">Title</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Location</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Price/Night</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Type</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Rating</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propertiesList.map((property) => (
                      <tr key={property.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-medium text-slate-900 max-w-xs truncate">
                          {property.title}
                        </td>
                        <td className="p-3 text-slate-600">
                          {property.location?.city}, {property.location?.country}
                        </td>
                        <td className="p-3 text-slate-600">
                          {property.currency === 'NGN' ? '₦' : '$'}{property.price_per_night?.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">
                            {property.property_type}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-600">
                          {property.rating ? (
                            <div className="flex items-center gap-1">
                              <span>⭐</span>
                              <span>{property.rating}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => handleEditProperty(property)}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 hover:bg-blue-50 border-blue-200"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleDeleteClick(property)}
                              variant="outline"
                              size="sm"
                              disabled={deletingPropertyId === property.id}
                              className="text-red-600 hover:bg-red-50 border-red-200"
                            >
                              {deletingPropertyId === property.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Property</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this property?
                {propertyToDelete && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                    <p className="font-semibold text-slate-900">{propertyToDelete.title}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      {propertyToDelete.location?.city}, {propertyToDelete.location?.country}
                    </p>
                  </div>
                )}
                <p className="mt-3 text-red-600 font-semibold">
                  This action cannot be undone.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowDeleteDialog(false);
                setPropertyToDelete(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Property
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Support Inbox Section */}
        <Card className="bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Support Inbox
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ minHeight: '500px' }}>
              {/* Ticket List */}
              <div className="md:col-span-1 border-r border-slate-200 pr-4 max-h-[500px] overflow-y-auto">
                <h3 className="font-semibold text-slate-800 mb-3">Open Tickets ({supportTickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length})</h3>
                {isLoadingTickets ? (
                  <p>Loading tickets...</p>
                ) : (
                  <div className="space-y-2">
                    {supportTickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').map(ticket => (
                      <div
                        key={ticket.id}
                        onClick={() => handleSelectTicket(ticket)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedTicket?.id === ticket.id ? 'bg-blue-50 border-blue-200 border' : 'hover:bg-slate-50 border border-transparent'}`}
                      >
                        <p className="font-semibold text-sm truncate">{ticket.subject}</p>
                        <p className="text-xs text-slate-500 truncate">{ticket.user_email}</p>
                        <Badge variant="outline" className="mt-1 text-xs capitalize">{ticket.status.replace('_', ' ')}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat View */}
              <div className="md:col-span-2 flex flex-col">
                {selectedTicket ? (
                  <>
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                      <div>
                        <h3 className="font-bold text-slate-900">{selectedTicket.subject}</h3>
                        <p className="text-sm text-slate-600">From: {selectedTicket.user_email}</p>
                      </div>
                      <div>
                        <Select value={selectedTicket.status} onValueChange={handleUpdateTicketStatus}>
                          <SelectTrigger className="w-[180px] rounded-xl">
                            <SelectValue placeholder="Update status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl p-4 overflow-y-auto space-y-4 mb-4" style={{ minHeight: '300px' }}>
                      {ticketMessages.map((message, index) => (
                        <div key={index} className={`flex w-full ${message.sender_type === 'user' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`p-3 rounded-xl max-w-md ${message.sender_type === 'user' ? 'bg-white border' : 'bg-blue-600 text-white'}`}>
                                <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                                <p className={`text-xs mt-1 text-right ${message.sender_type === 'user' ? 'text-slate-400' : 'text-blue-200'}`}>
                                  {new Date(message.created_date).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                      ))}
                      {ticketMessages.length === 0 && <p className="text-center text-slate-500">No messages yet.</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Type your reply..."
                        value={adminReply}
                        onChange={(e) => setAdminReply(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendAdminReply()}
                        disabled={isSendingReply}
                        className="rounded-xl"
                      />
                      <Button onClick={handleSendAdminReply} disabled={isSendingReply || !adminReply.trim()} className="rounded-xl">
                        {isSendingReply ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-center text-slate-500">
                    <div>
                      <MessageSquare className="w-12 h-12 mx-auto mb-2" />
                      <p>Select a ticket to view the conversation.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone Card */}
        <Card className="bg-red-50/90 border-red-200 rounded-3xl shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 mb-4">
              This is a high-risk area. Actions performed here are permanent and can result in data loss. Proceed with extreme caution.
            </p>
            <Button
              variant="destructive"
              onClick={handleDeleteAllProperties}
              disabled={isDeleting}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Properties
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Sample CSV Download */}
        <Card className="bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Sample CSV Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">
              Download a sample CSV file to see the required format for property data import.
            </p>
            <Button onClick={downloadSampleCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download Sample CSV
            </Button>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card className="bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Property Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="file-upload" className="text-sm font-semibold text-slate-700">
                Select CSV or Excel File
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="mt-2 rounded-xl border-slate-200"
              />
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {uploadedFile && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 border border-green-200 rounded-xl p-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">{uploadedFile.name}</p>
                    <p className="text-sm text-green-700">
                      Size: ${(uploadedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {uploadedFile && !extractedData && (
              <Button
                onClick={processUploadedFile}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-2" />
                    Processing File...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 mr-2" />
                    Process & Preview Data
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Data Preview */}
        {extractedData && (
          <Card className="bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Data Preview ({extractedData.length} properties)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto border rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Title</th>
                      <th className="text-left p-3 font-semibold">Location</th>
                      <th className="text-left p-3 font-semibold">Price</th>
                      <th className="text-left p-3 font-semibold">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.slice(0, 10).map((property, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">{property.title}</td>
                        <td className="p-3">{property.location.city}, {property.location.country}</td>
                        <td className="p-3">${property.price_per_night.toLocaleString()}</td>
                        <td className="p-3">{property.property_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {extractedData.length > 10 && (
                <p className="text-sm text-slate-500 mt-3">
                  Showing first 10 of {extractedData.length} properties
                </p>
              )}

              <Button
                onClick={importPropertiesToDatabase}
                disabled={isProcessing}
                className="w-full mt-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-2" />
                    Importing to Database...
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5 mr-2" />
                    Import to Database
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Import Results */}
        {importResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-white/90 backdrop-blur-sm border-slate-200 rounded-3xl shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {importResults.failed === 0 ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  Import Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-900">{importResults.successful}</div>
                    <div className="text-green-700">Successfully Imported</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-red-900">{importResults.failed}</div>
                    <div className="text-red-700">Failed Imports</div>
                  </div>
                </div>

                {importResults.errors.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold text-amber-900">Import Errors</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto text-sm text-amber-800">
                      {importResults.errors.map((error, index) => (
                        <div key={index} className="mb-1">{error}</div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {isProcessing && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="bg-white p-8 rounded-3xl shadow-xl">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-900 border-t-transparent mx-auto mb-4"></div>
                <p className="text-lg font-semibold text-slate-900 mb-2">Processing...</p>
                <Progress value={progress} className="w-64" />
                <p className="text-sm text-slate-600 mt-2">{progress.toFixed(0)}% complete</p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
