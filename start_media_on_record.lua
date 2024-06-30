obs = obslua

-- Name of the media source you want to control
local media_source_name = "script"

function script_description()
    return "Automatically start media source when recording starts and stop it when recording stops."
end

function script_load(settings)
    obs.obs_frontend_add_event_callback(on_event)
end

function on_event(event)
    if event == obs.OBS_FRONTEND_EVENT_RECORDING_STARTED then
        start_media_source()
    elseif event == obs.OBS_FRONTEND_EVENT_RECORDING_STOPPED then
        stop_media_source()
    end
end

function start_media_source()
    local source = obs.obs_get_source_by_name(media_source_name)
    if source ~= nil then
        -- Log that we found the source
        obs.script_log(obs.LOG_INFO, "Found media source: " .. media_source_name)

        -- Make the source visible
        obs.obs_source_set_enabled(source, true)

        -- Get the media source settings
        local media_settings = obs.obs_source_get_settings(source)

        -- Set the "Restart playback when source becomes active" option
        obs.obs_data_set_bool(media_settings, "restart_on_activate", true)

        -- Update the media source with new settings
        obs.obs_source_update(source, media_settings)

        -- Activate the source to start playback
        obs.obs_source_media_restart(source)

        -- Release the media source settings
        obs.obs_data_release(media_settings)

        -- Log to confirm the media source is being played
        obs.script_log(obs.LOG_INFO, "Media source started: " .. media_source_name)

        obs.obs_source_release(source)
    else
        obs.script_log(obs.LOG_WARNING, "Media source not found: " .. media_source_name)
    end
end

function stop_media_source()
    local source = obs.obs_get_source_by_name(media_source_name)
    if source ~= nil then
        -- Log that we found the source
        obs.script_log(obs.LOG_INFO, "Found media source: " .. media_source_name)

        -- Stop the media source
        obs.obs_source_media_stop(source)

        -- Make the source invisible
        obs.obs_source_set_enabled(source, false)

        -- Log to confirm the media source is stopped
        obs.script_log(obs.LOG_INFO, "Media source stopped: " .. media_source_name)

        obs.obs_source_release(source)
    else
        obs.script_log(obs.LOG_WARNING, "Media source not found: " .. media_source_name)
    end
end
